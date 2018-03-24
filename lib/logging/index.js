'use strict';

const { exec } = require('child-process-promise');
const serializeError = require('serialize-error');

const config = require('../../config');

let logFunc = console.log;

function log(...args) {
  logFunc(...args);
}

const debug = (...args) => log('debug', ...args);
const info = (...args) => log('info', ...args);

function error(data, err = null, timestamp = null) {
  let payload;
  if (!data) {
    payload = {};
  } else if (data instanceof Object) {
    payload = data;
  } else {
    payload = { message: data };
  }

  if (err) payload.error = serializeError(err);

  log('error', payload, timestamp);
}

function setLogFunction(logFunction) {
  logFunc = logFunction;
}

const packLogs = (outputDir) => {
  debug('Packing logs...');
  const promise = exec(`find ${config.logs.dir} -type f -exec basename {} ';' \
    | xargs -r tar -C ${config.logs.dir} -czf ${outputDir}/${config.logs.packageName}`)
      .catch((err) => {
        error({ outputDir, message: 'Failed to pack log files.' }, err);
        throw err;
      });

  const childProcess = promise.childProcess;
  childProcess.stderr.on('data', err => error('ChildProcess stdout: Failed to pack log files.', err));
  return promise;
};

module.exports = {
  setLogFunction,
  log,
  error,
  debug,
  info,
  packLogs,
};
