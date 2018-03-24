'use strict';

const ssh2 = require('ssh2');
const randomstring = require('randomstring');
const { Observable } = require('rxjs/Rx');
const { curry, noop } = require('lodash/fp');
const shellEscape = require('shell-escape');

const { toMs } = require('../../util/index');

const SSH_HANDSHAKE_TIMEOUT = toMs('second', 30);

/**
 * @param {string} host
 * @param {number} port
 * @param {string} username
 * @param {string} password
 * @return {Observable<R>}
 */
const createConnection = ({ host, port, username, password }) => Observable.create((observer) => {
  const connection = new ssh2.Client();
  let isReady = false;

  connection.on('error', (err) => {
    observer.error(err);
  });

  connection.on('close', (hasError) => {
    if (!isReady && !hasError) {
      observer.error(new Error('Unexpected connection close'));
    }
    observer.complete();
  });

  connection.on('ready', () => {
    isReady = true;
    observer.next(connection);
  });

  connection.connect({ host, port, username, password, readyTimeout: SSH_HANDSHAKE_TIMEOUT });

  return () => {
    connection.end();
  };
});

const closeConnection = connection => connection.end();

const runCommand = curry(({ command, stdout = null, stderr = null }, connection) => Observable.create((observer) => {
  connection.exec(command, (err, stream) => {
    if (err) {
      observer.error(err);
      return;
    }

    stream.on('error', (streamError) => { observer.error(streamError) });
    stream.on('close', (code) => {
      if (code !== 0) {
        observer.error(new Error('Command exited with non zero code'));
      }

      observer.next(connection); // return connection to allow command chain
      observer.complete();
      if (stdout !== null) { stdout.complete() }
      if (stderr !== null) { stderr.complete() }
    });

    stream.on('data', stdout !== null ? (data) => { stdout.next(data) } : noop);
    stream.stderr.on('data', stderr !== null ? (data) => { stderr.next(data) } : noop);
  });
}));

const runScript = (script, connection) => {
  const filename = `/tmp/${randomstring.generate({ length: 16 })}`;

  return runCommand({ command: `${shellEscape(['echo', script])} > ${filename}` }, connection)
    .concatMap(runCommand({ command: `${shellEscape(['sh', filename])} > /tmp/out.log 2>&1` }));
};

const createShell = connection => Observable.create((observer) => {
  let shell = null;

  connection.shell((err, stream) => {
    if (err) {
      observer.error(err);
      return;
    }

    shell = stream;
    stream.on('error', (streamError) => { observer.error(streamError) });
    stream.on('close', () => { observer.complete() });

    // listeners are required, otherwise shell won't close
    stream.on('data', noop);
    stream.stderr.on('data', noop);

    observer.next(stream);
  });

  return () => {
    if (shell !== null) { shell.end() }
  };
});

const runCommandInShell = curry((shell, command) => Observable.create((observer) => {
  shell.write(`${command}\n`, 'utf8', (err) => {
    if (err) { throw err }
    observer.next(command);
    observer.complete();
  });
}));

const waitForConnectionClose = connection => Observable.create((observer) => {
  const listener = () => {
    observer.next(connection);
    observer.complete();
  };

  connection.on('close', listener);
  connection.end();
  connection.destroy();

  return () => {
    connection.removeListener('close', listener);
  };
});

const waitForShellTermination = shell => Observable.create((observer) => {
  const listener = () => {
    observer.next(shell);
    observer.complete();
  };

  shell.on('close', listener);

  return () => {
    shell.removeListener('close', listener);
  };
});

module.exports = {
  createConnection,
  closeConnection,
  createShell,
  runCommand,
  runScript,
  waitForConnectionClose,
  runCommandInShell,
  waitForShellTermination,
};
