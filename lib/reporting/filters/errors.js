'use strict';

const { includes } = require('lodash/fp');
const { anyPass } = require('ramda');

const isRpcTimeout = includes('has timed out on');
const isSocketClosed = includes('not opened');
const isNoSpaceLeft = includes('No space left on device');
const isSslCertError = includes('The CA was unable to validate the file you provisioned');

const isIgnoredError = anyPass([isRpcTimeout, isSocketClosed, isNoSpaceLeft, isSslCertError]);

const errorFilter = ({ message = '' } = {}) => !isIgnoredError(message);

module.exports = errorFilter;
