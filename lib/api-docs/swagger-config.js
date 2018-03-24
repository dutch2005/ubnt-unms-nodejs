'use strict';

module.exports = {
  grouping: 'tags',
  info: {
    title: 'UNMS API',
    description: `
      You can authorize calls with x-auth-token by clicking the button on the right, to not have to fill in
      authorization token for each request. Entered value in authorization token for a request,
      will be replaced by the one entered in authorization. To get this token use /user/login request.
    `,
  },
  basePath: '/v2.1',
  tags: [
    { name: 'user', description: 'User authorization and settings' },
  ],
  securityDefinitions: {
    UserSecurity: {
      type: 'apiKey',
      in: 'header',
      name: 'x-auth-token',
      description: 'User authorization token',
    },
  },
  security: [
    {
      UserSecurity: [],
    },
  ],
  produces: [
    'application/json',
  ],
};
