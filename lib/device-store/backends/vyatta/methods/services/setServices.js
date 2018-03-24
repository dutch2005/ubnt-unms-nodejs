'use strict';

const { constant, isInteger, isString, has, compact, values, pick } = require('lodash/fp');
const { assocPath } = require('ramda');

const { setConfigRequest } = require('../../messages');

/**
 * @memberOf CommDevice
 * @this CommDevice
 * @param {CorrespondenceServices} cmServices
 * @return {Observable.<CorrespondenceDhcpLease[]>}
 */
function setServices(cmServices) {
  const { ntpClient, systemLog, telnetServer, snmpAgent, sshServer, webServer, discovery } = cmServices;
  let setData = {};
  let deleteData = {};

  // ntp
  deleteData = assocPath(['system', 'ntp'], "''", deleteData);
  if (ntpClient.enabled && (has('ntpServer1', ntpClient) || has('ntpServer2', ntpClient))) {
    const server = compact(values(pick(['ntpServer1', 'ntpServer2'], ntpClient)));
    setData = assocPath(['system', 'ntp'], { server }, setData);
  }

  // syslog server
  deleteData = assocPath(['system', 'syslog', 'host'], "''", deleteData);
  if (systemLog.enabled && isString(systemLog.server) && isString(systemLog.level)) {
    setData = assocPath([
      'system', 'syslog', 'host', systemLog.server,
      'facility', 'all', 'level'], systemLog.level, setData);
  }

  // telnet server
  if (telnetServer.enabled && isInteger(telnetServer.port)) {
    setData = assocPath(['service', 'telnet', 'port'], telnetServer.port, setData);
  } else {
    deleteData = assocPath(['service', 'telnet'], "''", deleteData);
  }

  // snmp agent
  if (snmpAgent.enabled) {
    setData = assocPath(['service', 'snmp', 'community', snmpAgent.community], "''", setData);
    setData = assocPath(['service', 'snmp', 'contact'], snmpAgent.contact, setData);
    setData = assocPath(['service', 'snmp', 'location'], snmpAgent.location, setData);
  } else {
    deleteData = assocPath(['service', 'snmp'], "''", deleteData);
  }
  // ssh server
  if (sshServer.enabled && isInteger(sshServer.sshPort)) {
    setData = assocPath(['service', 'ssh', 'port'], sshServer.sshPort, setData);
  } else {
    deleteData = assocPath(['service', 'ssh'], "''", deleteData);
  }

  // web server
  if (webServer.enabled) {
    if (isInteger(webServer.httpPort)) {
      setData = assocPath(['service', 'gui', 'http-port'], webServer.httpPort, setData);
    } else {
      deleteData = assocPath(['service', 'gui', 'http-port'], "''", deleteData);
    }

    if (isInteger(webServer.httpsPort)) {
      setData = assocPath(['service', 'gui', 'https-port'], webServer.httpsPort, setData);
    } else {
      deleteData = assocPath(['service', 'gui', 'https-port'], "''", deleteData);
    }
  } else {
    deleteData = assocPath(['service', 'gui'], "''", deleteData);
  }

  // discovery
  if (discovery.enabled) {
    deleteData = assocPath(['service', 'ubnt-discover'], "''", deleteData);
  } else {
    setData = assocPath(['service', 'ubnt-discover', 'disable'], "''", setData);
  }

  return this.connection.rpc(setConfigRequest(setData, deleteData));
}

module.exports = constant(setServices);
