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

    //set the model for this controller
    if( this.models[this.name.replace('-','_')] ) {
      this.model = this.models[this.name.replace('-','_')];
    }

  }

});
