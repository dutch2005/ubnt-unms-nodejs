'use strict';

const { get, flow } = require('lodash/fp');
const { assoc, when } = require('ramda');
const { isNotNil } = require('ramda-adjunct');
const url = require('url');

const { DB } = require('../../db');
const { allP } = require('../../util');
const config = require('../../../config');


module.exports = {
  up() {
    const nmsPromise = DB.nms.get();
    const hostnamePromise = nmsPromise
      .then(get('hostname'))
      .then(when(isNotNil, flow(url.parse, get('hostname'))));

    return allP([nmsPromise, hostnamePromise])
      .then(([nms, hostname]) => (isNotNil(hostname)
        ? assoc('hostname', hostname, nms)
        : nms
      ))
      .then(DB.nms.update);
  },
  down() {
    const nmsPromise = DB.nms.get();
    const hostnamePromise = nmsPromise.then(get('hostname'));
    const newHostnamePromise = allP([Promise.resolve(url.parse('')), hostnamePromise])
      .then(([newHostname, hostname]) => flow(
        assoc('protocol', 'https'),
        assoc('hostname', hostname),
        assoc('port', config.publicHttpsPort),
        url.format
      )(newHostname));


    return allP([nmsPromise, newHostnamePromise, hostnamePromise])
      .then(([nms, hostname]) => assoc('hostname', hostname, nms))
      .then(DB.nms.update);
  },
};
