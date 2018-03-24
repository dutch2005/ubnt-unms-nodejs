'use strict';

const { constant, partial } = require('lodash/fp');
const { stubNull } = require('ramda-adjunct');
const { pathOr, when, equals } = require('ramda');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../../backends/ubridge/messages');
const { fromHwOspfAreas } = require('../../../../../transformers/device/erouter/index');

const ospfAreasRequest = partial(rpcRequest, [{
  GET: {
    protocols: {
      ospf: { area: null },
    },
  },
}, 'getOspfAreas']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceOspfArea[]>}
 */
function getOspfAreas() {
  return this.connection.rpc(ospfAreasRequest())
    .map(pathOr(null, ['data', 'GET', 'protocols', 'ospf', 'area']))
    .map(when(equals('null'), stubNull))
    .mergeEither(fromHwOspfAreas);
}

module.exports = constant(getOspfAreas);

