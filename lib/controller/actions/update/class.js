"use strict";

var SuperJS = require('superjs-api');

module.exports = SuperJS.Action.extend({

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
          response[self.name] = result;
        }

        response.meta.message = "Successfully updated " + count + " " + self.name + " records from the database.";

        resolve(response);

      })
      .catch(function(err) {
        reject(err);
      });
  }

});