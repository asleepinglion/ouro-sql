module.exports = {

  description: 'The Knex controller provides essential CRUD methods.',
  methods: {

    search: {

      description: "Search the database records...",
      action: true,
      async: true,

      params: {

        select: {
          description: 'The select parameter allows you to select the fields you want to return.',
          type: 'object',
          default: {},
          transform: {
            object: true
          },
          validate: {
          }
        },

        where: {
          description: 'The where parameter allows you to filter records using a JSON-based query language.',
          type: 'object',
          default: {},
          transform: {
            object: true
          },
          validate: {
          }
        },

        sort: {
          description: 'The sort parameter allows you to sort records using standard SQL notation (e.g. field ASC).',
          type: 'string',
          default: "",
          validate: {
            //sortAttribute: true, //validate sort attribute
            //sortDirection: true //validate the sort direction
          }
        },

        limit: {
          description: 'The limit parameter allows you specify the number of results to return.',
          type: 'integer',
          default: 25,
          validate: {
            min: 0,
            max: 1000
          }
        },

        skip: {
          description: 'The skip parameter allows you to page results in conjunction with the limit parameter.',
          type: 'integer',
          default: 0,
          validate: {
            min: 0
          }
        },

        join: {
          description: 'The joins parameter allows you to specify associated data to return.',
          type: 'object',
          default: {},
          transform: {
            object: true
          },
          validate: {
          }
        }

      }

    },

    create: {

      description: "Create a new database record...",
      action: true,
      async: true,

      params: {

        attributes: {
          description: 'The attributes for the record you wish to create.',
          type: 'object',

          transform: {
            object: true
          },
          validate: {
            required: true
          }
        }

      }
    },

    update: {

      description: "Update a database record...",
      action: true,
      async: true,

      params: {

        where: {
          description: 'The where parameter allows you to filter records using a JSON-based query language.',
          type: 'object',
          default: {},
          transform: {
            object: true
          },
          validate: {
          }
        },

        attributes: {
          description: 'The attributes for the record you wish to update.',
          type: 'object',
          transform: {
            object: true
          },
          validate: {
            required: true
          }
        },

        limit: {
          description: 'The limit parameter allows you limit the number of results to update.',
          type: 'integer',
          default: 1,
          validate: {
            min: 0,
            max: 1000
          }
        }

      }
    },

    delete: {

      description: "Delete a new database record...",
      action: true,
      async: true,

      params: {

        where: {
          description: 'The where parameter allows you to filter records using a JSON-based query language.',
          type: 'object',
          default: {},
          transform: {
            object: true
          },
          validate: {
          }
        }

      }
    }

  }
};
