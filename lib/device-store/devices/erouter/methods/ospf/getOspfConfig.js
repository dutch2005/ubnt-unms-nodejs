'use strict';

const { constant, partial } = require('lodash/fp');
const { stubNull } = require('ramda-adjunct');
const { pathOr, when, equals } = require('ramda');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { fromHwOspfConfig } = require('../../../../../transformers/device/erouter/index');

const ospfConfigRequest = partial(rpcRequest, [{
  GET: {
    protocols: {
      ospf: {
        'default-information': null,
        redistribute: null,
        parameters: null,
      },
    },
  },
}, 'getOspfConfig']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceOspfArea[]>}
 */
function getOspfConfig() {
  return this.connection.rpc(ospfConfigRequest())
    .map(pathOr(null, ['data', 'GET', 'protocols', 'ospf']))
    .map(when(equals('null'), stubNull))
    .mergeEither(fromHwOspfConfig);
}

module.exports = constant(getOspfConfig);

