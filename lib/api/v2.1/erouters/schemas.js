'use strict';

const joi = require('joi');

const createDHCPServerValidation = joi.object({
  dns1: joi.string().ip().allow(null),
  dns2: joi.string().ip().allow(null),
  interface: joi.string().ip().required(),
  leaseTime: joi.number().required(),
  name: joi.string().min(1).required(),
  rangeStart: joi.string().ip().required(),
  rangeEnd: joi.string().ip().required(),
  router: joi.string().ip().allow(null),
  unifiController: joi.string().ip().allow(null),
  domain: joi.string().optional().allow(null),
}).label('CreateDHCPServer');

const updateDHCPServerValidation = joi.object({
  dns1: joi.string().ip().allow(null),
  dns2: joi.string().ip().allow(null),
  interface: joi.string().ip().required(),
  enabled: joi.bool().optional(),
  leaseTime: joi.number().required(),
  name: joi.string().min(1).required(),
  rangeStart: joi.string().ip().required(),
  rangeEnd: joi.string().ip().required(),
  router: joi.string().ip().allow(null),
  unifiController: joi.string().ip().allow(null),
  available: joi.number().min(0).optional().allow(null),
  poolSize: joi.number().min(0).optional().allow(null),
  leases: joi.number().min(0).optional().allow(null),
  domain: joi.string().optional().allow(null),
}).label('UpdateDHCPServer');

const DHCPServer = joi.object({
  dns1: joi.string().ip().allow(null),
  dns2: joi.string().ip().allow(null),
  interface: joi.string().ip().required(),
  enabled: joi.bool().required(),
  leaseTime: joi.number().required(),
  name: joi.string().min(1).required(),
  rangeStart: joi.string().ip().required(),
  rangeEnd: joi.string().ip().required(),
  router: joi.string().ip().allow(null),
  unifiController: joi.string().ip().allow(null),
  available: joi.number().min(0).required().allow(null),
  poolSize: joi.number().min(0).required().allow(null),
  leases: joi.number().min(0).required().allow(null),
}).label('DHCPServer');

const DHCPServerList = joi.array().items(DHCPServer).label('DHCPServerList');

const DHCPLeaseValidation = joi.object({
  leaseId: joi.string().min(1).required(),
  serverName: joi.string().min(1).required(),
  mac: joi.string().required(),
  address: joi.string().ip().required(),
  expiration: joi.string().optional().allow(null),
  hostname: joi.string().optional().allow(null),
  type: joi.string().optional().allow(null),
}).label('DHCPLease');

module.exports = {
  createDHCPServerValidation,
  updateDHCPServerValidation,
  DHCPServer,
  DHCPServerList,
  DHCPLeaseValidation,
};
