"use strict";

var Ouro = require('ouro-api');

module.exports = Ouro.Action.extend({

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  run: function(resolve, reject, req) {

    var self = this;

    this.model.update(req.parameters.where, req.parameters.attributes, req.parameters.limit)
      .then(function(result) {

        var count = 1;

        var response = {meta:{success: true}};

        if( typeof result === 'number' ) {
          count = result;
        } else {
          response[self.controller.name] = result;
        }

        response.meta.message = "Successfully updated " + count + " " + self.controller.name + " records from the database.";

        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });
  }

});
