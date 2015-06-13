"use strict";

var Ouro = require('ouro-api');

module.exports = Ouro.Action.extend({

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  run: function(resolve, reject, req) {

    var self = this;

    this.model.create(req.parameters.attributes)
      .then(function(result) {

        var response = {meta:{success: true, message: "Successfully created new " + self.controller.name + " record."}};
        response[self.controller.name] = result;
        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });
  }

});
