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
    this.filterOperators = ['startsWith', 'endsWith', 'contains', 'like', 'lessThan', 'greaterThan', 'lessThanOrEqual', 'greaterThanOrEqual', '<', '>', '<=', '>=', 'between', 'or'];

  },

  find: function(resolve, reject, criteria) {

    //save reference to the current instance
    var self = this;

    //setup criteria defaults
    criteria = criteria || {};

    //default to all fields if empty select
    if( typeof criteria.select !==  'object' || Object.keys(criteria.select).length === 0 ) {
      criteria.select = this.fields.slice();
      criteria.select = criteria.select.map(function(field) {
        return self.name + '.' + field;
      });
    }

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
    if( typeof criteria.sort === 'string' && criteria.sort.length > 0 ) {
      //todo: check whether sort field is allowed
      query.orderBy(criteria.sort);
    }

    //configure joins
    self.join(query, criteria.join);


    //filter the results using JSON search criteria
    var filterResult = this.filter(query, criteria.where);

    if( filterResult !== true  ) {

      reject(filterResult);

    } else {

      self.log.debug('executing query:', query.toString());

      query
        .then(function(records) {

          if( Object.keys(criteria.join).length > 0 ) {
            records = self.nestJoinedResults(records);
          }

          resolve(records);
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
        .then(function(result) {
          resolve(result);
        })
        .catch(function(err) {
          reject(err);
        })

    })
      .catch(function(err) {
        reject(err);
      });
  },

  update: function(resolve, reject, criteria, attributes) {

    var self = this;

    if( typeof criteria !== 'object' || Object.keys(criteria).length === 0 ) {
      return reject(new SuperJS.Error('bad_request', 'You must provide some criteria in order to update records.'));
    }

    var query = this.db.from(this.name);

    var filterResult = this.filter(query, criteria);

    if( filterResult !== true  ) {

      reject(filterResult);

    } else {

      query.update(attributes);

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

  join: function(query, joins) {

    //loop through requested joinsd
    for( var join in joins ) {

      //make sure the relationship is setup
      if( typeof this.relations[join] === 'object' ) {

        var joinModel = (typeof this.relations[join].model === 'string' ) ? this.relations[join].model : join;

        this.log.debug('model:', joinModel);
        this.log.debug('available models:', this.adapter);

        //make sure the model exists
        if( typeof this.adapter.models[joinModel] === 'object' ) {

          //check whether to use a through table
          if( typeof this.relations[join].through === 'string' ) {


          } else {

            //the via key is necessary to associate the join
            if( typeof this.relations[join].via === 'string' ) {

              var joinFields = this.adapter.models[joinModel].fields.slice();
              joinFields = joinFields.map(function(field) {
                return joinModel + '.' + field + ' as ' + join + '::' + field;
              });

              if( _.contains(this.fields, this.relations[join].via) ) {
                query.select(joinFields);
                query.leftOuterJoin(joinModel, joinModel + '.id', '=', this.name + '.' + this.relations[join].via);
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

  nestJoinedResults: function(records) {

    //loop through records
    return records.map(function(record) {

      var newRecord = {};

      for( var field in record ) {

        if( field.indexOf('::') > -1 ) {

          var joinField = field.split('::');

          if( typeof newRecord[joinField[0]] !== 'object' ) {
            newRecord[joinField[0]] = {};
          }

          newRecord[joinField[0]][joinField[1]] = record[field];

        } else {

          newRecord[field] = record[field];
        }

      }

      return newRecord;

    });

  },

  filter: function(query, filter, or) {

    var self = this;

    for( var attribute in filter ) {

      if( !this.attributes[attribute] && attribute !== 'or' ) {
        return new SuperJS.Error('invalid_attribute', 'The `' + attribute + '` attribute does not exist.');
      }

      if( typeof filter[attribute] === 'object' && _.isArray(filter[attribute]) ) {

        for( var condition in filter[attribute] ) {

          var filterResult = this.filter(query, filter[attribute][condition], true)

          if( filterResult !== true ) {
            return filterResult;
          }

        }

        continue;
      }

      if( typeof filter[attribute] === 'number' || typeof filter[attribute] === 'string' ) {

        query[(or)?'orWhere':'where'](attribute, filter[attribute]);

      } else if( typeof filter[attribute] === 'object' ) {

        if( _.isArray(filter[attribute]) ) {

          query[(or)?'orWhereIn':'whereIn'](attribute, filter[attribute]);

        } else {

          //only valid operators are allowed
          var invalidOperators = _.difference(Object.keys(filter[attribute]), this.filterOperators);
          if( invalidOperators.length > 0 ) {
            return new SuperJS.Error('invalid_operator', 'The following invalid operators were used in your query: ' + invalidOperators.toString());
          }

          if( typeof filter[attribute].startsWith === 'string' ) {

            query[(or)?'orWhere':'where'](attribute, 'like', filter[attribute].startsWith + '%' );

          } else if( typeof filter[attribute].endsWith === 'string' ) {

            query[(or)?'orWhere':'where'](attribute, 'like', '%' + filter[attribute].endsWith);

          } else if( typeof filter[attribute].contains === 'string' ) {

            query[(or)?'orWhere':'where'](attribute, 'like', '%' + filter[attribute].contains + '%');

          } else if( typeof filter[attribute].like === 'string' ) {

            query[(or)?'orWhere':'where'](attribute, 'like', filter[attribute].like);

          } else if( _.intersection(['lessThan', 'greaterThan', 'lessThanOrEqual', 'greaterThanOrEqual', '<', '>', '<=', '>='], Object.keys(filter[attribute])).length > 0 ) {

            if( typeof filter[attribute]['<'] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '<', filter[attribute]['<']);
            } else if( typeof filter[attribute]['<='] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '<=', filter[attribute]['<=']);
            } else if( typeof filter[attribute]['lessThan'] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '<', filter[attribute]['lessThan']);
            } else if( typeof filter[attribute]['lessThanOrEqual'] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '<=', filter[attribute]['lessThanOrEqual']);
            }

            if( typeof filter[attribute]['>'] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '>', filter[attribute]['>']);
            } else if( typeof filter[attribute]['>='] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '>=', filter[attribute]['>=']);
            } else if( typeof filter[attribute]['greaterThan'] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '>', filter[attribute]['greaterThan']);
            } else if( typeof filter[attribute]['greaterThanOrEqual'] === 'number' ) {
              query[(or)?'orWhere':'where'](attribute, '>=', filter[attribute]['greaterThanOrEqual']);
            }

          } else if( typeof filter[attribute].lessThan === 'number' ) {

            query[(or)?'orWhere':'where'](attribute, '<', filter[attribute].lessThan );

          } else if( typeof filter[attribute].greaterThan === 'number' ) {

            query[(or)?'orWhere':'where'](attribute, '>', filter[attribute].greaterThan );

          } else if( _.isArray(filter[attribute]['between']) ) {

            query[(or)?'orWhereBetween':'whereBetween'](attribute, filter[attribute]['between']);

          }


        }

      }

    }

    return true;

  }

});