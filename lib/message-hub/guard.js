'use strict';

const { isError } = require('lodash/fp');

const BUS_CLOSE_DELAY = 500;

const connectionGuard = (bus, server) => {
  const { logging } = server.plugins;

  const stopProcess = (error) => {
    if (isError(error)) {
      logging.error('Connection to rabbitMQ failed, terminating server', error);
    } else {
      logging.info('Connection to rabbitMQ closed, terminating server');
    }
    process.exit(1);
  };

  const startWatchDog = () => {
    logging.info('Starting RabbitMQ connection watchdog');
    bus.once('error', stopProcess);
    bus.once('connection.error', stopProcess);
    bus.once('connection.close', stopProcess);
  };

  const stopWatchDog = () => {
    logging.info('Stopping RabbitMQ connection watchdog');
    bus.removeListener('error', stopProcess);
    bus.removeListener('connection.error', stopProcess);
    bus.removeListener('connection.close', stopProcess);
  };

  server.once('stop', () => {
    stopWatchDog();
    setTimeout(() => bus.close(), BUS_CLOSE_DELAY); // delay close a little bit to allow last messages to pass through
  });

  return new Promise((resolve, reject) => {
    if (bus.initialized) {
      startWatchDog();
      resolve();
      return;
    }

    const failure = (error) => {
      if (isError(error)) {
        logging.error('Connection to rabbitMQ failed, server cannot be started', error);
      } else {
        logging.info('Connection to rabbitMQ closed during server startup');
      }

      reject(error);
    };

    bus.once('ready', () => {
      bus.removeListener('error', failure);
      bus.removeListener('connection.error', failure);
      bus.removeListener('connection.close', failure);
      startWatchDog();
      resolve();
    });

    bus.once('error', failure);
    bus.once('connection.error', failure);
    bus.once('connection.close', failure);
  });
};

module.exports = connectionGuard;
