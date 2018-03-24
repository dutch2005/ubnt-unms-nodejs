'use strict';

const { get: _get, set: _set, unset: _unset, concat } = require('lodash');

const data = {};


function set(path, value) {
  _set(data, path, value);
}

function get(path, defaultValue = null) {
  return _get(data, path, defaultValue);
}

function push(path, value) {
  const list = _get(data, path, []);
  _set(data, path, concat(list, [value]));
}

function unset(path) {
  _unset(data, path);
}


module.exports = {
  get,
  set,
  push,
  unset,
};
