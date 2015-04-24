"use strict";

var SuperJS = require('superjs');
SuperJS.Api = require('superjs-api');
var fs = require('fs');
var Knex = require('knex');

module.exports = SuperJS.Api.Adapter.extend({

  _metaFile: function() {
    this._loadMeta(__filename);
  },

  init: function(app) {

    //execute parent class' constructor
    this._super.apply(this, arguments);

    //localize the configuraiton
    this.config = this.app.config.data.adapters['boros-mysql'] || {};

    //maintain a list of connections
    this.connections = {};

    //maintain a list of loaded models
    this.models = {};

    //establish connections
    this.connect();

    //load models
    this.loadModels();

  },

  connect: function() {

    for( var connectionName in this.config.connections ) {

      this.log.debug('knex connection:',connectionName);

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

      this.connections[connectionName] = Knex(config);
    }

  },

  //find models by searching through modules folder
  loadModels: function() {

    //maintain reference to self
    var self = this;

    //make sure the apis folder has been defined
    if( fs.existsSync(self.app.paths.cwd+'/apis') ) {

      //get list of apis
      var apis = fs.readdirSync(self.app.paths.cwd+'/apis');

      //load each model
      apis.map(function(apiName) {

        //make sure the model exists
        if( fs.existsSync(self.app.paths.cwd+'/apis/'+apiName+'/model.js') ) {

          var Model = require(self.app.paths.cwd+'/apis/'+apiName+'/model');

          if( Model && typeof Model.prototype.adapter === 'string' && Model.prototype.adapter === 'knex' ) {
            self.loadModel(apiName, Model);
          }
        }

      });

    }

    this.log.debug('models loaded:',Object.keys(this.models));

  },

  loadModel: function(moduleName, Model) {

    //instantiate the model
    var model = new Model(this.app, this);

    //convert module name to table name format
    var modelName = moduleName.replace('-', '_');

    //set name based on the path if not set in the model
    if (!model.name || model.name === 'model' ) {
      model.name = modelName;
    }

    //store reference to this model
    this.models[modelName] = model;
  }



});