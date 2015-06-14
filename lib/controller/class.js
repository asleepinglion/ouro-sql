"use strict";

var Ouro = require('ouro');
Ouro.Api = require('ouro-api');

var _ = require('underscore');
var Promise = require('bluebird');

module.exports = Ouro.Api.Controller.extend({

  adapterName: 'sql',

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  init: function(app, adapter) {

    //call base class constructor
    this._super.apply(this,arguments);

    //mark controller as rest enabled
    this.restEnabled = true;

    //set the model for this controller
    if( this.models[this.name.replace('-','_')] ) {
      this.model = this.models[this.name.replace('-','_')];
    }

  }

});
