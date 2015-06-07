module.exports = {

  description: 'The Update action for the OuroSql Controller.',

  methods: {

    run: {

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
    }

  }

};
