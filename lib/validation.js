'use strict';

const joi = require('joi');
const { values } = require('lodash/fp');

const { toMs } = require('./util');
const {
  IntervalEnum, DeviceTypeEnum, SiteTypeEnum, StatusEnum, AlertTypeEnum, IpAddressTypeEnum, DiscoveryMethodEnum,
  MailServerTypeEnum, TaskTypeEnum, TimezoneListEnum, SmtpSecurityModeEnum, DeviceTransmissionProfileEnum,
  TableTypeEnum,
} = require('./enums');

const portNumber = joi.number().integer().min(0).max(65535);

exports.siteId = joi.string().guid().required();
exports.firmwareId = joi.string().guid();
exports.taskBatchId = joi.string().guid();
exports.interfaceName = joi.string().required();
exports.interfaceMtu = joi.number().min(1).required();
exports.interfaceAddresses = joi.array().items(joi.object({
  type: joi.valid(...values(IpAddressTypeEnum)).required(),
  cidr: joi.string().ip({ version: ['ipv4'], cidr: 'required' }).allow(null).required(),
})).required();
exports.userId = joi.string().guid().required();
exports.username = joi.string().alphanum().min(1).max(20)
  .required();
exports.password = joi.string().min(4).max(64).required();
exports.verificationCode = joi.string().length(6);
exports.sessionTimeout = joi.number().max(604800000).required();
exports.guidToken = joi.string().guid().required();
exports.hostname = joi.alternatives().try(joi.string().ip(), joi.string().hostname());
exports.macAddress = joi.string().regex(/^((\d|([a-f]|[A-F])){2}:){5}(\d|([a-f]|[A-F])){2}$/);
exports.smtp = joi.object().keys({
  type: joi.string().valid(
    MailServerTypeEnum.Smtp, MailServerTypeEnum.Gmail, MailServerTypeEnum.Cloud, MailServerTypeEnum.NoSmtp
  ),
  gmailUsername: joi.string().email().when('type', {
    is: MailServerTypeEnum.Gmail,
    then: joi.string().required(),
    otherwise: joi.string().allow(null),
  }),
  gmailPassword: joi.string().when('type', {
    is: MailServerTypeEnum.Gmail,
    then: joi.string().required(),
    otherwise: joi.string().allow(null),
  }),
  customSmtpHostname: joi.string().hostname().when('type', {
    is: MailServerTypeEnum.Smtp,
    then: joi.string().required(),
    otherwise: joi.string().allow(null),
  }),
  customSmtpPort: portNumber
    .when('type', {
      is: MailServerTypeEnum.Smtp,
      then: joi.number().required(),
      otherwise: joi.number().allow(null),
    }),
  customSmtpSecurityMode: joi.string().valid(...values(SmtpSecurityModeEnum)),
  tlsAllowUnauthorized: joi.boolean().when('type', {
    is: MailServerTypeEnum.Smtp,
    then: joi.boolean().required(),
  }),
  customSmtpAuthEnabled: joi.boolean().when('type', {
    is: MailServerTypeEnum.Smtp,
    then: joi.boolean().required(),
  }),
  customSmtpUsername: joi.string().when('customSmtpAuthEnabled', {
    is: true,
    then: joi.string().required(),
    otherwise: joi.string().allow(null),
  }),
  customSmtpPassword: joi.string().when('customSmtpAuthEnabled', {
    is: true,
    then: joi.string().required(),
    otherwise: joi.string().allow(null),
  }),
  customSmtpSender: joi.string().email().allow(null),
});
exports.onuId = joi.string().guid().required();
exports.oltId = joi.string().guid().required();
exports.deviceId = joi.string().guid().required();
exports.backupId = joi.string().guid().required();
exports.imageId = joi.string().guid().required();
exports.newSite = joi.object().keys({
  parentSiteId: joi.string().guid().allow(null),
  name: joi.string().required(),
  address: joi.string().allow(null),
  contactName: joi.string().allow(null),
  contactPhone: joi.string().allow(null),
  contactEmail: joi.string().allow(null),
  location: joi.object().allow(null).keys({
    longitude: joi.number().required(),
    latitude: joi.number().required(),
  }),
  height: joi.number().allow(null),
  elevation: joi.number().allow(null),
  note: joi.string().allow(null),
});
exports.site = joi.object().keys({
  id: joi.string().guid().required(),
  identification: joi.object().keys({
    id: joi.string().guid().required(),
    type: joi.string().valid(SiteTypeEnum.Site, SiteTypeEnum.Endpoint).required(),
    name: joi.string().required(),
    status: joi.string().valid(StatusEnum.Active, StatusEnum.Disconnected, StatusEnum.Inactive).required(),
    parent: joi.object().allow(null),
  }).required(),
  description: joi.object().keys({
    address: joi.string().allow(null),
    note: joi.string().allow(null),
    contact: joi.object().keys({
      name: joi.string().allow(null),
      phone: joi.string().allow(null),
      email: joi.string().allow(null),
    }).required(),
    location: joi.object().keys({
      longitude: joi.number().min(-180).max(180).required(),
      latitude: joi.number().min(-90).max(90).required(),
    }).allow(null).required(),
    height: joi.number().allow(null),
    elevation: joi.number().allow(null),
    endpoints: joi.array().items(joi.object()).allow(null),
  }).required(),
  notifications: joi.object().keys({
    type: joi.string().valid(AlertTypeEnum.System, AlertTypeEnum.Custom, AlertTypeEnum.None).required(),
    users: joi.array().items(
      joi.object().keys({
        id: joi.string().guid().required(),
        username: joi.string().required(),
        email: joi.string().email().required(),
        alerts: joi.boolean(),
        totpAuthEnabled: joi.boolean(),
      })
    ).min(0).required(),
  }),
});
exports.imageData = joi.object().keys({
  name: joi.string().allow(''),
  description: joi.string().allow(''),
});
exports.imageReorder = joi.object().keys({
  currentOrder: joi.number().required(),
  nextOrder: joi.number().required(),
});
exports.interval = joi.string().valid(...values(IntervalEnum)).required();
exports.domain = joi.string().required();
exports.deviceType = joi.string().valid(...values(DeviceTypeEnum));
exports.logsPeriod = joi.number().min(toMs('hour', 1));
exports.outagesPeriod = joi.number().min(toMs('hour', 1));
exports.routes = {
  destination: joi.string().ip({ version: ['ipv4'], cidr: 'required' }).required(),
  gateway: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
  interface: joi.string().required(),
};
exports.taskPayloads = {
  [TaskTypeEnum.FirmwareUpgrade]: joi.array().items(
    joi.object().keys({
      deviceId: exports.deviceId.required(),
      firmwareId: exports.firmwareId.required(),
    })
  ).min(1).required(),
};
exports.newTask = {
  type: joi.string().valid(values(TaskTypeEnum)).required(),
  payload: joi.alternatives()
    .when('type', { is: TaskTypeEnum.FirmwareUpgrade, then: exports.taskPayloads[TaskTypeEnum.FirmwareUpgrade] }),
};
exports.discoveryRequest = {
  method: joi.string().valid(...values(DiscoveryMethodEnum)).required(),
  single: joi.boolean().optional(),
  list: joi.when('method', {
    is: DiscoveryMethodEnum.Import,
    then: joi.array().items(
      joi.object().keys({
        username: joi.string().default(null).optional(),
        password: joi.string().default(null).optional(),
        sshPort: joi.number().default(null).optional(),
        httpsPort: joi.number().default(null).optional(),
        ip: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
      })
    ).min(1).required(),
    otherwise: joi.forbidden(),
  }),
  range: joi.when('method', {
    is: DiscoveryMethodEnum.IpRange,
    then: joi.object().keys({
      input: joi.string().required(),
      parsed: joi.array().items(
        joi.alternatives().try(
          joi.object().keys({
            type: joi.string().equal('single').required(),
            ip: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
          }),
          joi.object().keys({
            type: joi.string().equal('cidr').required(),
            cidr: joi.string().ip({ version: ['ipv4'], cidr: 'required' }).required(),
          }),
          joi.object().keys({
            type: joi.string().equal('explicit').required(),
            from: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
            to: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
          }),
          joi.object().keys({
            type: joi.string().equal('partial').required(),
            part: joi.number().min(0).max(255).required(),
            ip: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
          }),
          joi.object().keys({
            type: joi.string().equal('mask').required(),
            mask: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
            ip: joi.string().ip({ version: ['ipv4'], cidr: 'forbidden' }).required(),
          })
        )
      ).min(1).required(),
    }),
    otherwise: joi.forbidden(),
  }),
};

exports.discoveryDeviceIds = joi.array().items(joi.string().guid()).min(1);

exports.discoveryConnect = {
  devices: exports.discoveryDeviceIds.required(),
  preferences: joi.object().keys({
    useUnstableFirmware: joi.boolean().required(),
  }).allow(null).required(),
};

exports.discoveryCredentials = {
  devices: exports.discoveryDeviceIds.required(),
  credentials: joi.object().keys({
    username: joi.string().required(),
    password: joi.string().allow(null).required(),
    port: portNumber.default(22),
    httpsPort: portNumber.default(443),
    sshPort: portNumber.default(joi.ref('port')),
  }).required(),
};

exports.tableConfig = joi.object().keys({
  [TableTypeEnum.DeviceList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.EndpointList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.SiteList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.FirmwareList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.DiscoveryDeviceList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.DeviceBackupList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.DeviceInterfaceList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.ErouterStaticRouteList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.ErouterOspfRouteAreaList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.ErouterOspfRouteInterfaceList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.ErouterDhcpLeaseList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.ErouterDhcpServerList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.DeviceLogList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.DeviceOutageList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.AirMaxStationList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.SiteDeviceList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.SiteEndpointList]: joi.array().items(joi.string()).allow(null),
  [TableTypeEnum.OltOnuList]: joi.array().items(joi.string()).allow(null),
});

exports.firmwareDeleteList = joi.array().items(exports.firmwareId).min(1).required();

exports.timezone = joi.string().valid(TimezoneListEnum);

exports.DeviceTransmissionProfile = joi.string().valid(
  DeviceTransmissionProfileEnum.Minimal, DeviceTransmissionProfileEnum.Low, DeviceTransmissionProfileEnum.Medium,
  DeviceTransmissionProfileEnum.High
);
exports.devicePingAddress = joi.alternatives().try(joi.string().ip(), joi.string().hostname()).allow(null);
exports.devicePingIntervalNormal = joi.number().min(10000).max(200000).allow(null);
exports.devicePingIntervalOutage = joi.number().min(2000).max(100000).allow(null);
exports.deviceAlias = joi.string().max(30).empty(null).allow('').optional();
exports.deviceNote = joi.string().max(300).empty(null).allow('').optional();
