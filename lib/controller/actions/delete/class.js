"use strict";

var SuperJS = require('superjs-api');

module.exports = SuperJS.Action.extend({

  _metaFile: function() {
    this._super();
    this._loadMeta(__filename);
  },

  run: function(resolve, reject, req) {

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
