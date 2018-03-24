'use strict';

const aguid = require('aguid');

const { commandRequest } = require('../../../../../backends/ubridge/messages');
const { ubusRequest } = require('../../../../../backends/openwrt/messages');


const restoreBackupCommand = fileName =>
  commandRequest(`lua -e "dofile('/usr/share/ubnt/config'); restoreConfig('${fileName}')"`);


function applyBackup(data) {
  const fileName = `/tmp/${aguid()}.cfg`;

  return this.connection
    .rpc(ubusRequest({
      path: 'file',
      method: 'write',
      args: {
        path: fileName,
        data: data.toString('base64'),
        base64: true,
        mode: 777,
      },
    }))
    .mergeMap(() => this.connection.cmd(restoreBackupCommand(fileName)))
    .mergeMap(() => this.connection.rpc(ubusRequest({
      path: 'uci',
      method: 'reload_config',
      args: {},
    })));
}


module.exports = applyBackup;
