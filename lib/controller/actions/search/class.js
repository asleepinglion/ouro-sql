"use strict";

var Ouro = require('ouro-api');

module.exports = Ouro.Action.extend({

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  run: function(resolve, reject, req) {

    //maintain reference to instance
    var self = this;

    this.model.find(req.parameters)
      .then(function(results) {

        var response = {meta:{success: true, message: "Successfully searched the " + self.controller.name + " database and found " + results.length + " records."}};
        response[self.controller.name] = results;
        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });

  }

});
