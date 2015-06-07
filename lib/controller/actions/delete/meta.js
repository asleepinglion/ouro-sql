module.exports = {

  description: 'The Delete action for the OuroSql Controller.',

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
        }

      }
    }

  }

};
