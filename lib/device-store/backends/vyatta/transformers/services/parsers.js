'use strict';

const { getOr, parseInt } = require('lodash/fp');
const { when, pathSatisfies, isNil } = require('ramda');
const { isNotEmpty, isNotNull } = require('ramda-adjunct');

const { ServiceEnum } = require('../../../../../enums');

const DEFAULT_NTP_SERVERS = {
  ntpServer1: '0.pool.ntp.org',
  ntpServer2: '1.pool.ntp.org',
};

const parsePortNumber = when(isNotNull, parseInt(10));

/**
 * @param {Object} hwServices
 * @return {CorrespondenceServices}
 */
const parseHwServices = (hwServices) => {
  // ntp clients
  const ntpServerConfig = getOr({}, ['data', 'system', 'ntp', 'server'], hwServices);
  const ntpServers = Object.keys(ntpServerConfig).slice(0, 2);
  const { ntpServer1: ntpServerPrimary, ntpServer2: ntpServerSecondary } = DEFAULT_NTP_SERVERS;

  const ntpClient = { enabled: isNotEmpty(ntpServers) };
  ntpClient.ntpServer1 = ntpClient.enabled ? getOr(null, [0], ntpServers) : ntpServerPrimary;
  ntpClient.ntpServer2 = ntpClient.enabled ? getOr(null, [1], ntpServers) : ntpServerSecondary;

  // syslog server
  const syslogServerConfig = getOr({}, ['data', 'system', 'syslog', 'host'], hwServices);
  const syslogServers = Object.keys(syslogServerConfig);
  const syslogServer = getOr(null, [0], syslogServers);
  const systemLog = {
    server: syslogServer,
    level: getOr(null, ['facility', 'all', 'level'], syslogServerConfig[syslogServer]),
  };
  systemLog.enabled = isNotNull(systemLog.server);

  // telnet server
  const telnetServer = {
    port: getOr(null, ['data', 'service', 'telnet', 'port'], hwServices),
  };
  telnetServer.enabled = isNotNull(telnetServer.port);

  // snmp agent
  const snmpAgentCommunityConfig = getOr({}, ['data', 'service', 'snmp', 'community'], hwServices);
  const snmpAgentCommunities = Object.keys(snmpAgentCommunityConfig);
  const snmpAgentCommunity = getOr(null, [0], snmpAgentCommunities);
  const snmpAgent = {
    community: snmpAgentCommunity,
    contact: getOr(null, ['data', 'service', 'snmp', 'contact'], hwServices),
    location: getOr(null, ['data', 'service', 'snmp', 'location'], hwServices),
  };
  snmpAgent.enabled = isNotNull(snmpAgent.community);

  // ssh server
  const sshServer = {
    sshPort: parsePortNumber(getOr(null, ['data', 'service', 'ssh', 'port'], hwServices)),
  };
  sshServer.enabled = isNotNull(sshServer.sshPort);

  // web server
  const webServer = {
    httpsPort: parsePortNumber(getOr(null, ['data', 'service', 'gui', 'https-port'], hwServices)),
    httpPort: parsePortNumber(getOr(null, ['data', 'service', 'gui', 'http-port'], hwServices)),
  };
  webServer.enabled = isNotNull(webServer.httpsPort) || isNotNull(webServer.httpPort);

  // discovery
  const discovery = {
    enabled: pathSatisfies(isNil, ['data', 'service', 'ubnt-discover'], hwServices),
  };

  return {
    [ServiceEnum.NtpClient]: ntpClient,
    [ServiceEnum.SshServer]: sshServer,
    [ServiceEnum.SystemLog]: systemLog,
    [ServiceEnum.TelnetServer]: telnetServer,
    [ServiceEnum.SNMPAgent]: snmpAgent,
    [ServiceEnum.WebServer]: webServer,
    [ServiceEnum.Discovery]: discovery,
  };
};

module.exports = {
  parseHwServices,
};
