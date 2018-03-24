'use strict';

/*
 * Hapijs Plugin definition
 */

const { weave } = require('ramda-adjunct');

const { registerPlugin } = require('../../../util/hapi');
const { registerRoutes } = require('./routes');
const { getFirmwares, uploadFirmwareImage, removeFirmwares, countUnread, getUbntFirmwares } = require('./service');


function register(server, options) {
  const { firmwareDal, settings } = server.plugins;

  /**
   * @name FirmwareService
   * @type {{
   *    getFirmwares: function():Promise.<ApiFirmware[]>,
   *    uploadFirmwareImage: function(origin: string, fileStream: stream.Readable):Promise.<ApiFirmware>,
   *    removeFirmwares: function(firmwareIds: string[]):Promise.<ApiFirmware[]>
   * }}
   */
  const service = {
    getFirmwares: weave(getFirmwares, { firmwareDal }),
    uploadFirmwareImage: weave(uploadFirmwareImage, { firmwareDal }),
    removeFirmwares: weave(removeFirmwares, { firmwareDal }),
    countUnread: weave(countUnread, { firmwareDal }),
    getUbntFirmwares: weave(getUbntFirmwares, { firmwareDal, settings }),
  };

  server.expose(service);

  registerRoutes(server, options, service);
}

exports.register = registerPlugin(register);
exports.register.attributes = {
  name: 'apiFirmwaresV2.1',
  version: '1.0.0',
  dependencies: 'firmwareDal',
};
