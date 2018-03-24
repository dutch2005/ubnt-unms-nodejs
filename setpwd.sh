#!/usr/bin/node

'use strict';

require('pg').defaults.parseInt8 = true;
const { Sequelize } = require('sequelize');
const { ifElse, always, find, pathEq, prop, apply, equals, head, pipe, curryN, isEmpty, or, assoc } = require('ramda');
const { isNotNil, weave } = require('ramda-adjunct');
const { FlutureTMonetEither: FutureTEither } = require('monad-t');
const Future = require('fluture');
const read = require('read');
require('console.table');

const { DB } = require('./lib/db');
const { generatePasswordHashF } = require('./lib/auth');
const { pg } = require('./config');
const userRepository = require('./lib/dal/repositories/user');

const options = {
  dialect: 'postgres',
  host: pg.host,
  port: pg.port,
  logging: false,
};

const successFormat = '\n\n\x1b[32m%s\x1b[0m';
const errorFormat = '\n\n\x1b[31mError: %s\x1b[0m';

const sequelize = new Sequelize(pg.database, pg.user, pg.password, options);

const readF = Future.encaseN(read);

const listUsersFTE = FutureTEither.tryP(weave(userRepository.listUsernamesAndEmails, sequelize));
const setPasswordFTE = FutureTEither.encaseP2(weave(userRepository.setPasswordByUsername, sequelize));

const setPasswordFlow = input => FutureTEither.do(function* async() {
  const username = yield listUsersFTE
    .map(find(pathEq(['username'], input)))
    .filter(isNotNil, new Error(`User '${input}' not found`))
    .map(prop('username'));

  return yield FutureTEither.fromFuture(Future.parallel(1, [
    readF({ prompt: 'New password: ', silent: true }),
    readF({ prompt: 'Repeat password: ', silent: true }),
  ]))
    .filter(apply(equals), new Error('Passwords do not match'))
    .chain(pipe(head, generatePasswordHashF, FutureTEither.fromFuture.bind(FutureTEither)))
    .chain(setPasswordFTE(username))
    .tap(() => console.log(successFormat, `${username}'s password has been changed`));
});

const doNothing = always(FutureTEither.fromValue(0));

const resetSetup = () => FutureTEither.tryP(DB.nms.get)
  .map(assoc('isConfigured', false))
  .chain(() => FutureTEither.tryP(DB.nms.update))
  .tap(() => console.log(successFormat, 'UNMS will enter initial setup when open'));

const askToResetSetup = FutureTEither.fromFuture(readF({
  prompt: `UNMS has already been set up, but there are no users in the database. This should never happen.
Please let us know about the situation at
https://community.ubnt.com/t5/UNMS-Ubiquiti-Network-Management/bd-p/UNMSBeta

You may choose to run the initial UNMS setup again to re-create the default admin user.
Run UNMS setup again? [y/N]:`,
}));

const resetSetupFlow = () => FutureTEither.do(function* async() {
  const isConfigured = yield FutureTEither.tryP(DB.nms.get).map(prop('isConfigured'));

  if (!isConfigured) {
    console.error(errorFormat, 'UNMS has not been set up. Nothing to do.');
    return yield doNothing();
  }

  return yield askToResetSetup.tapF(ifElse(or(equals('y'), equals('yes')), resetSetup, doNothing));
});

const listUsersFlow = () => listUsersFTE
  .tap(curryN(2, console.table)('\n\nUNMS Users'))
  .tapF(ifElse(isEmpty, resetSetupFlow, doNothing));


FutureTEither.tryP(sequelize.authenticate.bind(sequelize))
  .map(always(process.argv[2]))
  .chain(ifElse(isNotNil, setPasswordFlow, listUsersFlow))
  .map(always(0))
  .fork(
    (err) => {
      console.error(errorFormat, err.message);
      process.exit(1);
    },
    process.exit
  );
