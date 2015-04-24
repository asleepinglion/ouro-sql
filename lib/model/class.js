"use strict";

var SuperJS = require('superjs');
SuperJS.Api = require('superjs-api');
var Promise = require('bluebird');
var _ = require('underscore');

module.exports = SuperJS.Api.Model.extend({

  adapter: 'knex',

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  init: function(app, adapter) {

    this._super.apply(this, arguments);

    //localize the db connection
    this.db = adapter.connections[this.connection];

    //store fields for easy access
    this.fields = Object.keys(this.attributes);

    //accepted filter operators
    this.filterOperators = ['startsWith', 'endsWith'];

  },

  find: function(resolve, reject, criteria) {

    //save reference to the current instance
    var self = this;

    //setup criteria defaults
    criteria = criteria || {};

    //default to all fields if empty select
    if( typeof criteria.select !==  'object' || Object.keys(criteria.select).length === 0 ) {
      criteria.select = this.fields.slice();    }

    criteria.where = (typeof criteria.where === 'object') ? criteria.where : {};
    criteria.limit = (typeof criteria.limit === 'number') ? criteria.limit : undefined;
    criteria.join = (typeof criteria.join === 'object') ? criteria.join : {};

    //generate query
    var query = this.db()
      .select(criteria.select)
      .from(this.name)
      .limit(criteria.limit)
      .offset(criteria.skip);

    this.filter(query, criteria.where)
      .then(function() {

        if( typeof criteria.sort === 'string' && criteria.sort.length > 0 ) {

          //todo: check whether sort field is allowed
          query.orderBy(criteria.sort);
        }

        self.log.debug('executing query:', query.toString());

        query
          .then(function(rows) {
            resolve(rows);
          })
          .catch(function(err) {
            reject(err);
          });

      })
      .catch(function(err) {
        reject(err);
      });

  },

  findOne: function(criteria) {

    //force limit to one record
    criteria.limit = 1;

    //return the find promise
    return this.find(criteria);

  },

  create: function(criteria) {

  },

  update: function(searchCriteria, values) {


  },

  destroy: function(criteria) {


  },

  filter: function(resolve, reject, query, filter) {

    //create array of filtered attributes
    //var attributes = Object.keys(filter);

    for( var attribute in filter ) {

      if( !this.attributes[attribute] ) {
        return reject(new SuperJS.Error('invalid_attribute', 'The `' + attribute + '` attribute does not exist.'));
      }

      var attributeType = typeof filter[attribute];

      if( attributeType === 'number' || attributeType === 'string' ) {

        query.where(attribute, filter[attribute]);

      } else if( typeof filter[attribute] === 'object' ) {

        if( _.isArray(filter[attribute]) ) {

          query.whereIn(attribute, filter[attribute]);

        } else {

          //only valid operators are allowed
          if( _.difference(Object.keys(filter[attribute]), this.filterOperators).length > 0 ) {
            return reject(new SuperJS.Error('invalid_operator', 'An invalid operator was used in your query.'));
          }

          if( typeof filter[attribute].startsWith === 'string' ) {

            query.where(attribute, 'like', filter[attribute].startsWith + '%');

          } else if( typeof filter[attribute].endsWith === 'string' ) {

            query.where(attribute, 'like', '%' + filter[attribute].endsWith);

          }


        }

      }

    }

    resolve();

  }

});