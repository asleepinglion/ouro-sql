"use strict";

var SuperJS = require('superjs');
SuperJS.Api = require('superjs-api');
var Promise = require('bluebird');
var _ = require('underscore');

module.exports = SuperJS.Api.Model.extend({

  adapterName: 'ourosql',

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  init: function(app, adapter) {

    this._super.apply(this, arguments);

    //store reference to the adapter
    this.adapter = adapter;

    //localize the db connection
    this.db = adapter.connections[this.connection];

    //store fields for easy access
    this.fields = Object.keys(this.attributes);

    //accepted filter operators
    this.filterOperators = ['=','!=','equal', 'notEqual', 'startsWith', 'endsWith', 'contains', 'like', 'lessThan', 'greaterThan', 'lessThanOrEqual', 'greaterThanOrEqual', '<', '>', '<=', '>=', 'between', 'in', 'notIn', 'or'];

  },

  find: function(resolve, reject, criteria) {

    //save reference to the current instance
    var self = this;

    //setup criteria defaults
    criteria = criteria || {};

    //default to all fields if empty select
    if( !_.isArray(criteria.select) || Object.keys(criteria.select).length === 0 ) {
      criteria.select = this.fields.slice();
    } else {

      var badFields = _.difference(criteria.select, this.fields);
      if( badFields.length > 0 ) {

        var details = [];

        for( var i = 0; i < badFields.length; i++ ) {
          details.push('The `' + badFields[i] + '` attribute is not valid.');
        }

        return reject(new SuperJS.Error('invalid_attribute', 'There are invalid attributes in your select list for the ' + this.name + ' model.', {details: details}));
      }

    }

    //prefix the model name to avoid ambiguous field names
    criteria.select = criteria.select.map(function(field) {
      return self.name + '.' + field;
    });

    criteria.where = (typeof criteria.where === 'object') ? criteria.where : {};
    criteria.limit = (typeof criteria.limit === 'number') ? criteria.limit : undefined;
    criteria.join = (typeof criteria.join === 'object') ? criteria.join : {};

    //generate query
    var query = this.db()
      .select(criteria.select)
      .from(this.name)
      .limit(criteria.limit)
      .offset(criteria.skip);

    //setup order by / sort
    if( ( typeof criteria.sort === 'object' || typeof criteria.sort === 'string' ) && criteria.sort.length > 0 ) {

      if( typeof criteria.sort === 'string' ) {
        criteria.sort = criteria.sort.split(" ");
      }

      if( criteria.sort.length === 1 ) {
        criteria.sort.push('asc');
      }

      if( this.fields.indexOf(criteria.sort[0]) === -1 ) {
        return reject(new SuperJS.Error('invalid_attribute', 'The attribute used in your sort criteria  for the ' + this.name + ' model is not valid.'));
      }

      query.orderBy(criteria.sort[0], criteria.sort[1]);
    }

    //setup one-to-one joins
    var joinResult = self.joinOne(query, criteria.join);

    //reject if an error occured building joins
    if( joinResult !== true ) {
      return reject(joinResult);
    }


    //filter the results using JSON search criteria
    var filterResult = this.filter(query, self.name, criteria.where);

    //reject if an error occured trying to build filters
    if( filterResult !== true  ) {

      return reject(filterResult);

    } else {

      self.log.debug('executing query:', query.toString());

      //execute query
      query
        .then(function(records) {

          //post-process records
          records = self.process(records);

          //only join additional records if results were found
          if( records.length > 0 ) {

            //execute many to many joins
            self.joinMany(criteria.join, records)
              .then(function(records) {

                //return records
                resolve(records);

              })
              .catch(function(err) {
                reject(err);
              });

          } else {

            resolve(records);
          }

        })
        .catch(function(err) {
          reject(err);
        });
    }

  },

  findOne: function(resolve, reject, criteria) {

    //force limit to one record
    criteria.limit = 1;

    //return the find promise
    this.find(criteria)
      .then(function(records) {
        resolve(records[0]);
      })
      .catch(function(err) {
        reject(err);
      });

  },

  create: function(resolve, reject, attributes) {

    //maintain reference to instance
    var self = this;

    //setup the query object
    var query = this.db(this.name);

    //process attributes before insertion
    attributes = this.processAttributes(attributes);

    console.log(attributes);

    //setup attributes to insert
    query.insert(attributes);

    self.log.debug('executing query:', query.toString());

    //insert new record into the database
    query.then(function(id) {

      //get the complete record from the database
      self.db
        .select(self.fields.slice())
        .from(self.name)
        .where('id', id)
        .then(function(records) {

          //post-process the record
          records[0] = self.processRecord(records[0]);

          resolve(records[0]);
        })
        .catch(function(err) {
          reject(err);
        });

    })
      .catch(function(err) {
        reject(err);
      });
  },

  update: function(resolve, reject, criteria, attributes) {

    //maintain reference to instance
    var self = this;

    //make sure attributes have been passed
    if( typeof attributes !== 'object' ) {
      return reject(new SuperJS.Error('bad_request', 'You must provide attributes to update.'));
    }

    //if the id was passed in use that in the criteria
    if( typeof attributes.id === 'number' || typeof attributes.id === 'string' ) {
      criteria = {id: attributes.id};
      delete attributes.id;
    }

    //make sure criteria has been provided
    if( typeof criteria !== 'object' || Object.keys(criteria).length === 0 ) {
      return reject(new SuperJS.Error('bad_request', 'You must provide some criteria in order to update records.'));
    }

    //setup the query
    var query = this.db.from(this.name);

    //filter the query
    var filterResult = this.filter(query, this.name, criteria);

    //make sure there were no issues with the filters
    if( filterResult !== true  ) {

      reject(filterResult);

    } else {

      //process attributes before insertion
      attributes = this.processAttributes(attributes);

      //set the attributes to update
      query.update(attributes);

      self.log.debug('executing query:', query.toString());

      //execute update query
      query
        .then(function(count) {

          //if updating only a single record
          if( typeof criteria.id === 'number') {

            //retrurn the complete record from the database
            self.db
              .select(self.fields.slice())
              .from(self.name)
              .where('id', criteria.id)
              .then(function(records) {

                if( records.length > 0 ) {

                  //post-process the record
                  records[0] = self.processRecord(records[0]);

                } else {

                  return reject(new SuperJS.Error('record_not_found', 'The id specified was not found in the ' + self.name + ' database.'));
                }

                return resolve(records[0]);
              })
              .catch(function (err) {
                return reject(err);
              });

          } else {

            //otherwise return the count
            return resolve(count);
          }
        })
        .catch(function(err) {
          return reject(err);
        });
    }


  },

  delete: function(resolve, reject, criteria) {

    var self = this;

    if( typeof criteria !== 'object' || Object.keys(criteria).length === 0 ) {
      return reject(new SuperJS.Error('bad_request', 'You must provide some criteria in order to delete records.'));
    }

    var query = this.db.from(this.name);

    var filterResult = this.filter(query, criteria);

    if( filterResult !== true  ) {

      reject(filterResult);

    } else {

      query.delete();

      self.log.debug('executing query:', query.toString());

      query
        .then(function(count) {
          resolve(count);
        })
        .catch(function(err) {
          reject(err);
        });
    }

  },

  joinOne: function(query, joins) {

    //loop through requested joins
    for( var join in joins ) {

      //many to many joins are executed in additional queries
      if( typeof this.relations[join].through !== 'string' && typeof this.relations[join].via === 'string') {

        //make sure the relationship is setup
        if( typeof this.relations[join] !== 'object' ) {
          return new SuperJS.Error('invalid_join', 'The `' + join + '` relationship has not been defined.');
        }

        var joinModel = (typeof this.relations[join].model === 'string' ) ? this.relations[join].model : join;

        //make sure the model exists
        if( typeof this.adapter.models[joinModel] !== 'object' ) {
          return new SuperJS.Error('invalid_join', 'The `' + joinModel + '` requested model has not be defined.');
        }

        //get a list of the join models' fields
        var joinFields = this.adapter.models[joinModel].fields.slice();

        //select fields from join query
        if (joins[join].select) {

          var badFields = _.difference(joins[join].select, joinFields);
          if( badFields.length > 0 ) {

            var details = [];

            for( var i = 0; i < badFields.length; i++ ) {
              details.push('The `' + badFields[i] + '` attribute is not valid.');
            }

            return new SuperJS.Error('invalid_attribute', 'There are invalid attributes in your `' + join + '` join select list.', {details: details});
          }

          joinFields = joins[join].select;
        }

        //prefix join fields to avoid conficts & aid in nesting
        joinFields = joinFields.map(function (field) {
          return joinModel + '.' + field + ' as ' + join + '::' + field;
        });

        if (_.contains(this.fields, this.relations[join].via) ) {

          //set the join type
          joins[join]._type = 'oneToOne';

          query.select(joinFields);
          query.leftOuterJoin(joinModel, this.name + '.' + this.relations[join].via, '=', joinModel + '.id');

          if( typeof joins[join].where === 'object' ) {

            //filter the results using JSON search criteria
            var filterResult = this.adapter.models[joinModel].filter(query, joinModel, joins[join].where);

            if( filterResult !== true ) {
              return filterResult;
            }

          }

        } else {
          return new SuperJS.Error('invalid_join', 'The `' + this.relations[join].via + '` via attribute for this one-to-one join was not found on the `' + this.name + '` model.');
        }

      }
    }

    return true;

  },

  joinMany: function(resolve, reject, joins, records) {

    //maitain reference to instance
    var self = this;

    //get list of ids to associate
    var recordIds = _.pluck(records, 'id');

    //maintain list of join queries to execute
    var joinQueries = {};

    //loop through requested joins
    for( var join in joins ) {

      if( joins[join]._type !== 'oneToOne' ) {

        //make sure the relationship is setup
        if( typeof this.relations[join] !== 'object') {
          return reject(new SuperJS.Error('invalid_join', 'The `' + join + '` relationship has not been defined.'));
        }

        var joinModel = (typeof this.relations[join].model === 'string' ) ? this.relations[join].model : join;

        //make sure the model exists
        if( typeof this.adapter.models[joinModel] !== 'object') {
          return reject(new SuperJS.Error('invalid_join', 'The `' + joinModel + '` model specified in the the relationship has not be defined.'));
        }

        if( typeof this.adapter.models[joinModel].relations !== 'object' ||
          typeof this.adapter.models[joinModel].relations[this.name] !== 'object'  ) {
            return reject(new SuperJS.Error('invalid_join', 'The `' + join + '` the opposite site of the relationship has not been defined.'));
        }

        //determine type of many join
        if( typeof this.relations[join].through === 'string' ) {

          //many to many relationships using through queries require both sides of the relationship to set the via property
          if( typeof this.relations[join].via !== 'string' && typeof this.adapter.models[joinModel].relations[this.name].via !== 'string' ) {
            return reject(new SuperJS.Error('invalid_join', 'The `' + join + '` relationship uses a through table but both sides need to set the via property.'));
          } else {
            joins[join]._type = 'manyToMany';
          }

        } else if( typeof this.relations[join].via === 'string' && typeof this.adapter.models[joinModel].relations[this.name].via === 'string' ) {

          //one to many relationships need to determine the dominant side of the join using the via property
          return reject(new SuperJS.Error('invalid_join', 'The `' + join + '` relationship does not use a through table, so only the dominant side should specify the via property.'));

        } else if( typeof this.adapter.models[joinModel].relations[this.name].via === 'string' ) {

          joins[join]._type = 'oneToMany';

        } else {

          return reject(new SuperJS.Error('invalid_join', 'The `' + join + '` relationship is not configured correctly.'));
        }

        var joinFields = this.adapter.models[joinModel].fields.slice();

        //select fields from join query
        if (joins[join].select) {

          var badFields = _.difference(joins[join].select, joinFields);
          if( badFields.length > 0 ) {

            var details = [];

            for( var i = 0; i < badFields.length; i++ ) {
              details.push('The `' + badFields[i] + '` attribute is not valid.');
            }

            return reject(new SuperJS.Error('invalid_attribute', 'There are invalid attributes in your `' + join + '` join select list.', {details: details}));
          }

          joinFields = joins[join].select;
        }

        //prefix join fields to avoid conficts & aid in nesting
        joinFields = joinFields.map(function (field) {
          return joinModel + '.' + field;
        });


        if( joins[join]._type === 'manyToMany' ) {

          //add relationship id so we can properly add it to the appropriate record
          joinFields.push(this.relations[join].through + '.' + this.relations[join].via + ' as related::' + join + '::id');

          //setup our many to many query
          var query = this.db();
          query.select(joinFields);
          query.from(joinModel);
          query.innerJoin(this.relations[join].through, this.relations[join].through + '.' + this.adapter.models[joinModel].relations[this.name].via, '=', joinModel + '.id');
          query.whereIn(this.relations[join].through + '.' + this.relations[join].via, recordIds);

          if( typeof joins[join].where === 'object' ) {

            //filter the results using JSON search criteria
            var filterResult = this.adapter.models[joinModel].filter(query, joinModel, joins[join].where);

            //reject if filter failed
            if( filterResult !== true ) {
              return reject(filterResult);
            }

          }

          //add to query list so they can execute in parallel
          joinQueries[join] = query;

          this.log.debug('executing join query:', query.toString());

        } else if( joins[join]._type === 'oneToMany' ) {

          //add relationship id so we can properly add it to the appropriate record
          joinFields.push(joinModel + '.' + this.adapter.models[joinModel].relations[this.name].via + ' as related::' + joinModel + '::id');

          //setup our one to many query
          var query = this.db();
          query.select(joinFields);
          query.from(joinModel);
          query.whereIn(joinModel + '.' + this.adapter.models[joinModel].relations[this.name].via, recordIds);

          if( typeof joins[join].where === 'object' ) {

            //filter the results using JSON search criteria
            var filterResult = this.adapter.models[joinModel].filter(query, joinModel, joins[join].where);

            //reject if filter failed
            if( filterResult !== true ) {
              return reject(filterResult);
            }

          }

          //add to query list so they can execute in parallel
          joinQueries[join] = query;

          this.log.debug('executing join query:', query.toString());

        }

      }
    }

    //execute many to many joins if any were found
    if( Object.keys(joinQueries).length > 0 ) {

      //execute join queries in parallel
      Promise.props(joinQueries)
        .then(function(results) {

          //setup identity map object
          var identityMap = {};

          //map records and create identity map
          records.map(function(record) {
            identityMap[record.id] = record;
          });

          //loop through each join query
          for( var join in results ) {

            //map records of join query
            results[join].map(function(joinRecord) {

              //temporarily store the related id
              var relatedId = joinRecord['related::' + join + '::id'];

              //create an array for joined results on primary record
              if( typeof identityMap[relatedId][join] !== 'object' ) {
                identityMap[relatedId][join] = [];
              }

              //delete related id from joined record
              delete joinRecord['related::' + join + '::id'];

              //process joined record (convert json to objects)
              //console.log('calling processRecord', join);
              joinRecord = self.adapter.models[join].processRecord(joinRecord);

              //append joined record to primary record
              identityMap[relatedId][join].push(joinRecord);

            });
          }

          resolve(records);

        })
        .catch(function(err) {
          reject(err);
        });

    } else {

      resolve(records);
    }


  },

  process: function(records) {

    var self = this;

    //loop through records
    return records.map(function(record) {

      //execute post processing on record
      return self.processRecord(record);

    });

  },

  processRecord: function(record) {

    var self = this;

    //console.log(record);

    //setup new record object
    var newRecord = {};

    //loop through each field of the record
    for( var field in record ) {

      //nest one-to-one joined records
      if( field.indexOf('::') > -1 ) {

        var joinField = field.split('::');

        //create new join object on primary record if one doesn't exist
        if( typeof newRecord[joinField[0]] !== 'object' ) {
          newRecord[joinField[0]] = {};
        }

        //set joined field in nested object on primary record
        newRecord[joinField[0]][joinField[1]] = record[field];

      } else {

        //console.log(field, self.attributes[field]);

        //translate json to objects
        if( self.attributes[field].type === 'json' || self.attributes[field].type === 'object' ) {

          //attempt to parse json
          try {
            record[field] = JSON.parse(record[field]);
          } catch(err) {
            //todo: return parsing error?
          }
        }

        //set modified value on new record
        newRecord[field] = record[field];

      }

    }

    //return new record to replace input
    return newRecord;

  },

  processAttributes: function(attributes) {

    var self = this;

    return _.mapObject(attributes, function(value, attribute) {

      if( (self.attributes[attribute].type === 'json' || self.attributes[attribute].type === 'object')  && typeof value === 'object' ) {

        //attempt to parse json
        try {
          value = JSON.stringify(value);
        } catch(err) {
          throw new SuperJS.Error('invalid_json', 'The `' + attribute + '` attribute is set to json/object, and the object passed failed to convert to json.');
        }

        return value;
      } else {
        return value;
      }

    });

  },

  filter: function(query, table, filter, or) {

    var self = this;

    var method = {
      where: (or) ? 'orWhere' : 'where',
      whereIn: (or) ? 'orWhereIn' : 'whereIn',
      whereNotIn: (or) ? 'orWhereNotIn' : 'whereNotIn',
      whereBetween: (or) ? 'orWhereBetween' : 'whereBetween',
    };

    for( var attribute in filter ) {

      if( !this.attributes[attribute] && attribute !== 'or' ) {
        return new SuperJS.Error('invalid_attribute', 'The `' + attribute + '` attribute does not exist on the ' + self.name + ' model.');
      }

      //handle or conditions
      if( attribute === 'or' && typeof filter[attribute] === 'object' && _.isArray(filter[attribute]) ) {

        for( var condition in filter[attribute] ) {

          var filterResult = self.filter(query, table, filter[attribute][condition], true)

          if( filterResult !== true ) {
            return filterResult;
          }

        }

        continue;
      }

      if( typeof filter[attribute] === 'number' || typeof filter[attribute] === 'string' ) {

        query[method.where](table + '.' + attribute, filter[attribute]);

      } else if( typeof filter[attribute] === 'object' ) {

        if( _.isArray(filter[attribute]) ) {

          query[method.whereIn](table + '.' + attribute, filter[attribute]);

        } else {

          //only valid operators are allowed
          var invalidOperators = _.difference(Object.keys(filter[attribute]), this.filterOperators);
          if( invalidOperators.length > 0 ) {
            return new SuperJS.Error('invalid_operator', 'The following invalid operators were used in your query: ' + invalidOperators.toString());
          }

          if( typeof filter[attribute]['='] === 'string' ) {

            query[method.where](table + '.' + attribute, filter[attribute]['=']);

          } else if( typeof filter[attribute]['equal'] === 'string' ) {

            query[method.where](table + '.' + attribute, filter[attribute]['equal']);

          } else if( typeof filter[attribute]['!='] === 'string'  ) {

            query[method.where](table + '.' + attribute, '!=', filter[attribute]['!=']);

          } else if( typeof filter[attribute]['notEqual'] === 'string' ) {

            query[method.where](table + '.' + attribute, '!=', filter[attribute]['notEqual']);

          } else if( typeof filter[attribute].startsWith === 'string' ) {

            query[method.where](table + '.' + attribute, 'like', filter[attribute].startsWith + '%' );

          } else if( typeof filter[attribute].endsWith === 'string' ) {

            query[method.where](table + '.' + attribute, 'like', '%' + filter[attribute].endsWith);

          } else if( typeof filter[attribute].contains === 'string' ) {

            query[method.where](table + '.' + attribute, 'like', '%' + filter[attribute].contains + '%');

          } else if( typeof filter[attribute].like === 'string' ) {

            query[method.where](table + '.' + attribute, 'like', filter[attribute].like);

          } else if( _.intersection(['lessThan', 'greaterThan', 'lessThanOrEqual', 'greaterThanOrEqual', '<', '>', '<=', '>='], Object.keys(filter[attribute])).length > 0 ) {

            if( typeof filter[attribute]['<'] === 'number' ) {
              query[method.where](table + '.' + attribute, '<', filter[attribute]['<']);
            } else if( typeof filter[attribute]['<='] === 'number' ) {
              query[method.where](table + '.' + attribute, '<=', filter[attribute]['<=']);
            } else if( typeof filter[attribute]['lessThan'] === 'number' ) {
              query[method.where](table + '.' + attribute, '<', filter[attribute]['lessThan']);
            } else if( typeof filter[attribute]['lessThanOrEqual'] === 'number' ) {
              query[method.where](table + '.' + attribute, '<=', filter[attribute]['lessThanOrEqual']);
            }

            if( typeof filter[attribute]['>'] === 'number' ) {
              query[method.where](table + '.' + attribute, '>', filter[attribute]['>']);
            } else if( typeof filter[attribute]['>='] === 'number' ) {
              query[method.where](table + '.' + attribute, '>=', filter[attribute]['>=']);
            } else if( typeof filter[attribute]['greaterThan'] === 'number' ) {
              query[method.where](table + '.' + attribute, '>', filter[attribute]['greaterThan']);
            } else if( typeof filter[attribute]['greaterThanOrEqual'] === 'number' ) {
              query[method.where](table + '.' + attribute, '>=', filter[attribute]['greaterThanOrEqual']);
            }

          } else if( typeof filter[attribute].lessThan === 'number' ) {

            query[method.where](table + '.' + attribute, '<', filter[attribute].lessThan );

          } else if( typeof filter[attribute].greaterThan === 'number' ) {

            query[method.where](table + '.' + attribute, '>', filter[attribute].greaterThan );

          } else if( _.isArray(filter[attribute]['between']) ) {

            query[method.whereBetween](table + '.' + attribute, filter[attribute]['between']);

          } else if( _.isArray(filter[attribute]['in']) ) {

            query[method.whereIn](table + '.' + attribute, filter[attribute]['in']);

          } else if( _.isArray(filter[attribute]['notIn']) ) {

            query[method.whereNotIn](table + '.' + attribute, filter[attribute]['notIn']);

          }


        }

      }

    }

    return true;

  }

});
