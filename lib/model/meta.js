module.exports = {

  class: "Model",
  extends: "Model",
  description: "The Knex model class provides a common interface to Waterline models.",

  methods: {

    find: {
      description: "Find records from in the model which match specified criteria.",
      async: true
    },

    filter: {
      description: "Apply filters to query based on JSON criteria format.",
      async: true
    }
  }

};
