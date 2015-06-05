"use strict";

var SuperJS = require('superjs');
SuperJS.Api = require('superjs-api');

var _ = require('underscore');
var Promise = require('bluebird');

module.exports = SuperJS.Api.Controller.extend({

  adapterName: 'ourosql',

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  init: function(app, adapter) {

    //call base class constructor
    this._super.apply(this,arguments);

    //mark controller as rest enabled
    this.restEnabled = true;

    //maintain a reference to the adapter
    this.adapter = adapter;

    //maintain a reference to models
    this.models = this.adapter.models;

    //set the model for this controller
    if( this.models[this.name] ) {
      this.model = this.models[this.name];
      this._mergeModelMeta();
    }

  },

  search: function(resolve, reject, req) {

    //maintain reference to instance
    var self = this;

    this.model.find(req.parameters)
      .then(function(results) {

        var response = {meta:{success: true, message: "Successfully searched the " + self.name + " database and found " + results.length + " records."}};
        response[self.name] = results;
        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });

  },

  create: function(resolve, reject, req) {

    var self = this;

    this.model.create(req.parameters.attributes)
      .then(function(result) {

        var response = {meta:{success: true, message: "Successfully created new " + self.name + " record."}};
        response[self.name] = result;
        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });
  },

  update: function(resolve, reject, req) {

    var self = this;

    this.model.update(req.parameters.where, req.parameters.attributes, req.parameters.limit)
      .then(function(result) {

        var count = 1;

        var response = {meta:{success: true}};

        if( typeof result === 'number' ) {
          count = result;
        } else {
          response[self.name] = result;
        }

        response.meta.message = "Successfully updated " + count + " " + self.name + " records from the database.";

        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });
  },

  delete: function(resolve, reject, req) {

    var self = this;

    this.model.delete(req.parameters.where)
      .then(function(count) {

        var response = {meta:{success: true, message: "Successfully deleted " + count + " " + self.name + " records from the database."}};
        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });

  }

});
