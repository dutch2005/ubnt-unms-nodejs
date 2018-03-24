'use strict';

const { Observable } = require('rxjs/Rx');
const { constant, partial } = require('lodash/fp');
const { pathOr } = require('ramda');

require('../../../../../util/observable');
const { rpcRequest } = require('../../../ubridge/messages');
const { merge: mergeM } = require('../../../../../transformers');
const { fromAllHwRoutes, fromConfigHwRoutes } = require('../../../../../transformers/device/erouter');
const { mergeConfigAndAllHwRoutes } = require('../../../../../transformers/device/erouter/mergers');

const configRoutesRequest = partial(rpcRequest, [{ GET: { protocols: { static: null } } }, 'getConfigRoutes']);
const allRoutesRequest = partial(rpcRequest, [{ GETDATA: 'routes' }, 'getAllRoutes']);

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @return {Observable.<CorrespondenceRoute[]>}
 */
function getRoutes() {
  const configRoutes$ = this.connection.rpc(configRoutesRequest())
    .map(pathOr({}, ['data', 'GET', 'protocols', 'static']));
  const allRoutes$ = this.connection.rpc(allRoutesRequest())
    .map(pathOr([], ['data', 'output']));

  return Observable.forkJoin(configRoutes$, allRoutes$)
    .mergeEither(([hwConfigRoutes, hwAllRoutes]) => {
      const configRoutes = fromConfigHwRoutes(hwConfigRoutes);
      const allRoutes = fromAllHwRoutes(hwAllRoutes);

      return allRoutes.chain(mergeM(mergeConfigAndAllHwRoutes, configRoutes));
    });
}

module.exports = constant(getRoutes);

