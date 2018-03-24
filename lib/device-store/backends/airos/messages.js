'use strict';

const { partial } = require('lodash/fp');

const { rpcRequest, commandRequest } = require('../ubridge/messages');

const deviceStatusRequest = partial(rpcRequest, [{}, 'getStatus']);

const stationListRequest = partial(rpcRequest, [{}, 'getWStaList']);

/* eslint-disable max-len */
const DEVICE_CONFIG_CMD = [
  'echo "getConfig"',
  'echo -e -n "[firmware]\\nversion="',
  'cat /etc/version 2>&1',
  'echo [ip]',
  'ifconfig `ip route show default 0/0 | sed \'s/\\(.*dev \\)\\([a-z.0-9-]*\\)\\(.*\\)/\\2/g\' | grep -v lo` | grep -v \'127.0\' | sed -rn \'s/\\b\\w+:([0-9]{1,3}\\.){3}[0-9]{1,3}\\b/\\nIP&\\n/gp\' | sed -n \'s/IP//p\' | tr ":" "=" | tr A-Z a-z | head -3',
  'echo "[board]"',
  'cat /proc/ubnthal/board.info 2>&1',
  'echo "[configuration]"',
  'cat /tmp/system.cfg 2>&1',
].join('; ');
/* eslint-enable max-len */

const deviceConfigRequest = partial(commandRequest, [DEVICE_CONFIG_CMD]);

const CONFIG_CHECK_CMD = 'echo "getConfigCheck"; md5sum /tmp/running.cfg | cut -d" " -f1';

const configCheckRequest = partial(commandRequest, [CONFIG_CHECK_CMD]);

// only M

// eslint-disable-next-line max-len
const INTERFACE_STATS_CMD = 'echo "getInterfaceStats"; /usr/www/ifstats.cgi | sed \'1,/^\\r\\{0,1\\}$/d\' | tr -d "\\n\\r\\t"';

const interfacesStatsRequest = partial(commandRequest, [INTERFACE_STATS_CMD]);

// only AC
const AIR_VIEW_CMD = 'echo "getAirView"; cat /tmp/airview/data 2>&1';

const airViewRequest = partial(commandRequest, [AIR_VIEW_CMD]);

module.exports = {
  deviceStatusRequest,
  stationListRequest,
  interfacesStatsRequest,
  deviceConfigRequest,
  configCheckRequest,
  airViewRequest,
};
