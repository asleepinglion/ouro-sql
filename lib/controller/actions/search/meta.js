module.exports = {

  description: 'The Search action for the OuroSql Controller.',

  methods: {

    run: {

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

    }

  }

};
