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
    this.filterOperators = ['=','!=','equal', 'notEqual', 'startsWith', 'endsWith', 'contains', 'like', 'lessThan', 'greaterThan', 'lessThanOrEqual', 'greaterThanOrEqual', '<', '>', '<=', '>=', 'between', 'or'];

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

        return reject(new SuperJS.Error('invalid_attribute', 'There are invalid attributes in your select list.', {details: details}));
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
        return reject(new SuperJS.Error('invalid_attribute', 'The attribute used in your sort criteria is not valid.'));
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

          //execute many to many joins
          self.joinMany(criteria.join, records)
            .then(function(records) {

              //return records
              resolve(records);

            })
            .catch(function(err) {
              reject(err);
            });

        })
        .catch(function(err) {
          reject(err);
        });
    }

  },

  findOne: function(criteria) {

    //force limit to one record
    criteria.limit = 1;

    //return the find promise
    return this.find(criteria);

  },

  create: function(resolve, reject, attributes) {

    //maintain reference to instance
    var self = this;

    //setup the query object
    var query = this.db(this.name);

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
    if( typeof attributes.id === 'number' ) {
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
    var filterResult = this.filter(query, criteria.where);

    //make sure there were no issues with the filters
    if( filterResult !== true  ) {

      reject(filterResult);

    } else {

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

                //post-process the record
                records[0] = self.processRecord(records[0]);

                resolve(records[0]);
              })
              .catch(function (err) {
                reject(err);
              });

          } else {

            //otherwise return the count
            resolve(count);
          }
        })
        .catch(function(err) {
          reject(err);
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

    //loop through requested joinsd
    for( var join in joins ) {

      //make sure the relationship is setup
      if( typeof this.relations[join] === 'object' ) {

        //todo: remove the option to set different name for join?
        var joinModel = (typeof this.relations[join].model === 'string' ) ? this.relations[join].model : join;

        //make sure the model exists
        if( typeof this.adapter.models[joinModel] === 'object' ) {

          //make sure the via key has been defined
          if( typeof this.relations[join].via === 'string' ) {

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

            //many to many joins using through tables execute separately
            if( typeof this.relations[join].through !== 'string') {

              if (_.contains(this.fields, this.relations[join].via)) {
                query.select(joinFields);
                query.innerJoin(joinModel, joinModel + '.id', '=', this.name + '.' + this.relations[join].via);

                if( typeof joins[join].where === 'object' ) {

                  //filter the results using JSON search criteria
                  var filterResult = this.adapter.models[joinModel].filter(query, joinModel, joins[join].where);

                  if( filterResult !== true ) {
                    return filterResult;
                  }

                }
              }

            }
          }

        }

      } else {

        return new SuperJS.Error('invalid_join', 'The `' + join + '` relationship has not be defined.');

      }

    }

    return true;

  },

  joinMany: function(resolve, reject, joins, records) {

    //maintain reference to instance
    var self = this;

    //get list of ids to associate
    var recordIds = _.pluck(records, 'id');

    //maintain lit of join queries to execute
    var joinQueries = {};

    //loop through requested joinsd
    for( var join in joins ) {

      //make sure the relationship is setup
      if (typeof this.relations[join] === 'object') {

        //todo: remove the option to set different name for join?
        var joinModel = (typeof this.relations[join].model === 'string' ) ? this.relations[join].model : join;

        //make sure the model exists
        if (typeof this.adapter.models[joinModel] === 'object') {

          //make sure the via key has been defined
          if (typeof this.relations[join].via === 'string') {

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

            //make sure through model has been specified
            if (typeof this.relations[join].through === 'string') {

              //make sure the opposite end of the relationship has been defined
              if( typeof this.adapter.models[joinModel].relations === 'object' &&
                typeof this.adapter.models[joinModel].relations[this.name] === 'object' &&
                typeof this.adapter.models[joinModel].relations[this.name].via === 'string' ) {

                //add relationship id so we can properly add it to the appropriate record
                joinFields.push(this.relations[join].through + '.' + this.relations[join].via + ' as related::id');

                //setup our many to many query
                var query = this.db();
                query.select(joinFields);
                query.from(joinModel);
                query.innerJoin(this.relations[join].through, this.relations[join].through + '.' + this.adapter.models[joinModel].relations[this.name].via, '=', joinModel + '.id');
                query.whereIn(this.relations[join].through + '.' + this.relations[join].via, recordIds);

                if( typeof joins[join].where === 'object' ) {

                  //filter the results using JSON search criteria
                  var filterResult = this.adapter.models[joinModel].filter(query, joinModel, joins[join].where);

                  //
                  if( filterResult !== true ) {
                    return reject(filterResult);
                  }

                }

                //add to query list so they can execute in parallel
                joinQueries[join] = query;

                this.log.debug('executing join query:', query.toString());


              } else {
                return reject(new SuperJS.Error('invalid_join', 'The `' + joinModel + '` through relation is not defined.'));
              }

            }
          }

        }

      } else {

        return reject(new SuperJS.Error('invalid_join', 'The `' + join + '` relationship has not be defined.'));

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
              var relatedId = joinRecord['related::id'];

              //create an array for joined results on primary record
              if( typeof identityMap[relatedId][join] !== 'object' ) {
                identityMap[relatedId][join] = [];
              }

              //delete related id from joined record
              delete joinRecord['related::id'];

              //process joined record (convert json to objects)
              joinRecord = self.adapter.models[joinModel].processRecord(joinRecord);

              //append joined record to primary record
              identityMap[relatedId][join].push(joinRecord);

            });
          }

          resolve(records);

        })
        .catch(function(err) {
          reject(err);
        })
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

  filter: function(query, table, filter, or) {

    var self = this;

    var method = {
      where: (or) ? 'orWhere' : 'where',
      whereIn: (or) ? 'orWhereIn' : 'whereIn',
      whereBetween: (or) ? 'orWhereBetween' : 'whereBetween',
    };

    for( var attribute in filter ) {

      if( !this.attributes[attribute] && attribute !== 'or' ) {
        return new SuperJS.Error('invalid_attribute', 'The `' + attribute + '` attribute does not exist.');
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

      //console.log(attribute);

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

          }


        }

      }

    }

    return true;

  }

});
