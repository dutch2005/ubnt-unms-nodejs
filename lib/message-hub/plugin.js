'use strict';

const servicebus = require('servicebus');
const retry = require('servicebus-retry');
const serializeError = require('serialize-error');
const { curry } = require('lodash/fp');

const Correlator = require('./correlator');
const connectionGuard = require('./guard');
const { registerPlugin } = require('../util/hapi');
const messages = require('./messages');

/*
 * Hapi plugin definition
 */
function register(server, options) {
  const { logging } = server.plugins;
  const { host, port, exchange: exchangeName } = options;
  const bus = servicebus.bus({
    url: `amqp://${host}:${port}`,
    exchangeName,
    correlator: new Correlator(),
    enableConfirms: true,
  });

  bus.use(bus.logger({
    fnIncoming(channel, message, queueOptions) {
      logging.log(['info', 'message-hub'], `receiving on ${queueOptions.queueName} via ${message.fields.routingKey}`);
    },
    fnOutgoing(message, queueName) { logging.log(['info', 'message-hub'], `sending to ${queueName}`) },
  }));
  bus.use(retry({ store: new retry.MemoryStore() }));

  const handlers = [];

  /**
   * @typedef {Object} MessageHub
   * @property {ServiceBus} bus
   * @property {Messages} messages
   * @property {Function} publish
   * @property {Function} subscribe
   */

  /** @type {MessageHub} */
  const pluginApi = {
    bus,
    messages,
    logError: curry((message, error) => {
      logging.log(['error', 'message-hub'], {
        message: `Message ${message.fields.routingKey} failed to be consumed`,
        error: serializeError(error),
      });
    }),
    registerHandlers: (handlersModule) => { handlers.push(handlersModule) },
    publish: ({ routingKey, payload }, ...args) => {
      try {
        bus.publish(routingKey, payload, ...args);
      } catch (error) {
        logging.error('Error during publishing message', error);
      }
    },
    publishAndConfirm: ({ routingKey, payload }, config = {}) => new Promise((resolve, reject) => {
      bus.publish(routingKey, payload, config, err => (err !== null ? reject(err) : resolve()));
    }),
    subscribe: (pattern, ...args) => bus.subscribe(String(pattern), ...args),
  };

  server.once('start', () => {
    handlers.forEach(handlersModule => handlersModule.register(server, pluginApi, messages));
  });

  server.expose(pluginApi);

  return connectionGuard(bus, server);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'messageHub',
  version: '1.0.0',
  dependencies: ['logging'],
};
