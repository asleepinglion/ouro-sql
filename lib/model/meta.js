module.exports = {

  class: "Model",
  extends: "Model",
  description: "The Knex model class provides a common interface to Waterline models.",

  methods: {

    find: {
      description: "Find records from in the database which match specified criteria.",
      async: true
    },

    create: {
      description: "Create records using the attributes provided.",
      async: true
    },

    update: {
      description: "Update records using the criteria and attributes provided.",
      async: true
    },

    delete: {
      description: "Delete records from the database based on specified criteria.",
      async: true
    },

    filter: {
      description: "Apply filters to query based on JSON criteria format."
    }
  }

};
