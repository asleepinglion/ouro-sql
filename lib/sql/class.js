"use strict";

var Ouro = require('ouro');
Ouro.Api = require('ouro-api');
var fs = require('fs');
var Knex = require('knex');

module.exports = Ouro.Api.Adapter.extend({

  name: 'sql',

  _metaFile: function() {
    this._loadMeta(__filename);
  },

  init: function(app, options) {

    //execute parent class' constructor
    this._super.apply(this, arguments);

    //localize the configuraiton
    this.config = options || {};

    //maintain a list of connections
    this.connections = {};

    //maintain a list of loaded models
    this.models = {};

  },

  loadModel: function(moduleName, Model) {

    //convert module name to table name format
    var modelName = moduleName.replace('-', '_');

    //instantiate the model
    var model = new Model(this.app, this, modelName);

    //store reference to this model
    this.models[modelName] = model;
  },

  finalize: function() {

    this.log.debug('establishing sql connections:', Object.keys(this.config.connections));

    for (var connectionName in this.config.connections) {

      var connection = this.config.connections[connectionName];

      //setup configuration defaults
      var config = {};
      config.client = connection.client || 'mysql';
      config.pool = connection.pool;
      config.migrations = connection.migrations;
      config.debug = connection.debug;

      //remove options from connection object
      delete connection.client;
      delete connection.pool;
      delete connection.migrations;
      delete connection.debug;

      //setup conneciton defaults
      connection.user = connection.user || 'root';
      connection.port = connection.port || 3306;
      connection.host = connection.host || '127.0.0.1';

      //store the connetion object on the config
      config.connection = connection;

      //create the connection
      this.connections[connectionName] = Knex(config);

      for( var model in this.models ) {
        this.models[model].db = this.connections[this.models[model].meta.connection];
      }
    }

  }

});