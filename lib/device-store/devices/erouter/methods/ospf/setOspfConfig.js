'use strict';

const { constant } = require('lodash/fp');
const { assocPath, path, pathSatisfies } = require('ramda');
const { isNotNull } = require('ramda-adjunct');

const { setConfigRequest } = require('../../../../backends/vyatta/messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceOspfConfig} newConfig
 * @return {Observable.<CorrespondenceDhcpServer[]>}
 */
function setOspfConfig(newConfig) {
  let setData = {};

  // routerID hw instructions
  if (pathSatisfies(isNotNull, ['router'], newConfig)) {
    setData = assocPath(['protocols', 'ospf', 'parameters', 'router-id'], newConfig.router, setData);
  }

  // redistribute default route hw instructions
  if (path(['redistributeDefaultRoute', 'enabled'], newConfig)) {
    setData = assocPath(['protocols', 'ospf', 'default-information', 'originate'], "''", setData);
  }

  // redistribute static routes hw instructions
  if (path(['redistributeStatic', 'enabled'], newConfig)) {
    if (pathSatisfies(isNotNull, ['redistributeStatic', 'metric'], newConfig)) {
      const metric = path(['redistributeStatic', 'metric'], newConfig);

      setData = assocPath(['protocols', 'ospf', 'redistribute', 'static'], { metric }, setData);
    } else {
      setData = assocPath(['protocols', 'ospf', 'redistribute', 'static'], "''", setData);
    }
  }

  // redistribute connected routes hw instructions
  if (path(['redistributeConnected', 'enabled'], newConfig)) {
    if (pathSatisfies(isNotNull, ['redistributeConnected', 'metric'], newConfig)) {
      const metric = path(['redistributeConnected', 'metric'], newConfig);

      setData = assocPath(['protocols', 'ospf', 'redistribute', 'connected'], { metric }, setData);
    } else {
      setData = assocPath(['protocols', 'ospf', 'redistribute', 'connected'], "''", setData);
    }
  }

  // remove current ospf config hw instructions
  const deleteData = assocPath(['protocols', 'ospf'], {
    redistribute: "''",
    parameters: { 'router-id': "''" },
    'default-information': "''",
  }, {});

  return this.connection.rpc(setConfigRequest(setData, deleteData));
}

module.exports = constant(setOspfConfig);

