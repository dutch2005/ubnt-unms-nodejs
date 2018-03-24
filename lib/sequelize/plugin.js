'use strict';

const { registerPlugin } = require('../util/hapi');

function register(server, options) {
  const { sequelize } = options;

  server.expose('sequelize', sequelize);
  server.decorate('request', 'sequelize', sequelize);
  process.on('beforeExit', () => sequelize.close());
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'sequelize',
  version: '1.0.0',
};

