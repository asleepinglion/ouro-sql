module.exports = {

  description: 'The Create action for the OuroSql Controller.',

  methods: {

    run: {

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
    }

  }

};
