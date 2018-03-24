'use strict';

const moment = require('moment-timezone');

const toMs = (type, num) => moment.duration(num, type).asMilliseconds();

/**
 * @readonly
 * @enum {string[]}
 */
const TimezoneListEnum = moment.tz.names();

/**
 * @readonly
 * @enum {string[]}
 */
const TimeFormatEnum = [
  'H:mm', 'h:mm a',
];

/**
 * @readonly
 * @enum {string[]}
 */
const DateFormatEnum = [
  'D MMM YYYY',
  'Do MMM YYYY',
  'DD MMM YYYY',
  'MMM D, YYYY',
  'MMM Do, YYYY',
  'MMM DD, YYYY',
  'YYYY-MM-DD',
  'DD-MM-YYYY',
  'D.M.YYYY',
  'DD.MM.YYYY',
  'D/M/YYYY',
  'DD/MM/YYYY',
  'M/D/YYYY',
  'MM/DD/YYYY',
];

/**
 * @readonly
 * @enum {string}
 */
const DeviceTypeEnum = Object.freeze({
  Onu: 'onu',
  Olt: 'olt',
  Erouter: 'erouter',
  Eswitch: 'eswitch',
  AirCube: 'airCube',
  AirMax: 'airMax',
});

/**
 * @readonly
 * @enum {string}
 */
const DeviceTypeApiRouteEnum = Object.freeze({
  [DeviceTypeEnum.Onu]: 'onus',
  [DeviceTypeEnum.Olt]: 'olts',
  [DeviceTypeEnum.Erouter]: 'erouters',
  [DeviceTypeEnum.Eswitch]: 'eswitches',
  [DeviceTypeEnum.AirCube]: 'aircubes',
  [DeviceTypeEnum.AirMax]: 'airmaxes',
});

/**
 * @readonly
 * @enum {string}
 */
const AirMaxSeriesEnum = Object.freeze({
  AC: 'AC',
  M: 'M',
});

/**
 * @readonly
 * @enum {string}
 */
const DeviceCategoryEnum = Object.freeze({
  Optical: 'optical',
  Wired: 'wired',
  Wireless: 'wireless',
});

/**
 * @readonly
 * @enum {string}
 */
const DeviceConnectionFailedReasonEnum = Object.freeze({
  Decryption: 'decryption',
});

/**
 * @readonly
 * @enum {string}
 */
const OspfAuthTypeEnum = Object.freeze({
  Md5: 'md5',
  Plaintext: 'plaintext-password',
  None: 'off',
});

/**
 * @readonly
 * @enum {string}
 */
const OspfAuthTypeLabelEnum = Object.freeze({
  [OspfAuthTypeEnum.Md5]: 'MD5',
  [OspfAuthTypeEnum.Plaintext]: 'Plain text',
  [OspfAuthTypeEnum.None]: 'Off',
});

/**
 * @readonly
 * @enum {string}
 */
const OspfAreaTypeEnum = Object.freeze({
  Default: 'normal',
  Nssa: 'nssa',
  Stub: 'stub',
});

/**
 * @readonly
 * @enum {string}
 */
const OspfAreaTypeLabelEnum = Object.freeze({
  [OspfAreaTypeEnum.Default]: 'Default',
  [OspfAreaTypeEnum.Nssa]: 'NSSA',
  [OspfAreaTypeEnum.Stub]: 'Stubby',
});

/**
 * @readonly
 * @enum {string}
 */
const RouteTypeEnum = Object.freeze({
  KernelRoute: 'K',
  Connected: 'C',
  Static: 'S',
  RIP: 'R',
  OSPF: 'O',
});

/**
 * @readonly
 * @enum {string}
 */
const RouteTypeLabelEnum = Object.freeze({
  [RouteTypeEnum.KernelRoute]: 'Kernel Route',
  [RouteTypeEnum.Connected]: 'Connected',
  [RouteTypeEnum.Static]: 'Static',
  [RouteTypeEnum.RIP]: 'RIP',
  [RouteTypeEnum.OSPF]: 'OSPF',
});

/**
 * @readonly
 * @enum {string}
 */
const StaticRouteTypeEnum = Object.freeze({
  Interface: 'interface',
  Blackhole: 'blackhole',
  Gateway: 'gateway',
});

/**
 * @readonly
 * @enum {string}
 */
const StaticRouteTypeLabelEnum = Object.freeze({
  [StaticRouteTypeEnum.Interface]: 'Interface',
  [StaticRouteTypeEnum.Blackhole]: 'Blackhole',
  [StaticRouteTypeEnum.Gateway]: 'Gateway',
});

/**
 * @readonly
 * @enum {string}
 */
const RouteGatewayStatusEnum = Object.freeze({
  Reachable: 'reachable',
  Unreachable: 'Unreachable',
});

/**
 * @readonly
 * @enum {string}
 */
const RouteGatewayStatusLabelEnum = Object.freeze({
  [RouteGatewayStatusEnum.Reachable]: 'Reachable',
  [RouteGatewayStatusEnum.Unreachable]: 'Unreachable',
});

/**
 * @readonly
 * @enum {string}
 */
const StatusEnum = Object.freeze({
  All: null,
  Active: 'Active',
  Inactive: 'Inactive',
  Disabled: 'Disabled',
  Disconnected: 'Disconnected',
  Unauthorized: 'Unauthorized',
  Proposed: 'Proposed',
  Unknown: 'Unknown',
});

/**
 * @readonly
 * @enum {string}
 */
const NmsUpdateStatusEnum = Object.freeze({
  Ready: 'ready',
  Requested: 'requested',
  Started: 'started',
  Updating: 'updating',
});

/**
 * @readonly
 * @enum {string}
 */
const DiscoveryConnectStatusEnum = Object.freeze({
  All: null,
  Connected: 'connected',
  Pending: 'pending',
  NotConnected: 'unconnected',
});

/**
 * @readonly
 * @enum {string}
 */
const DiscoveryConnectProgressEnum = Object.freeze({
  Failed: 'failed',
  FirmwareUpgrade: 'firmware-upgrade',
  SettingConnectionString: 'setting-connection-string',
  Waiting: 'waiting',
});

/**
 * @readonly
 * @enum {string}
 */
const DiscoveryDeviceFlagsEnum = Object.freeze({
  All: null,
  CanConnect: 'canConnect',
  CanAuthenticate: 'canAuthenticate',
  UnsupportedDevice: 'unsupportedDevice',
  UnsupportedFirmware: 'unsupportedFirmware',
  MissingCredentials: 'missingCredentials',
  Error: 'error',
});

/**
 * @readonly
 * @enum {string}
 */
const DiscoveryMethodEnum = Object.freeze({
  IpRange: 'ip-range',
  Import: 'import',
});

/**
 * @readonly
 * @enum {string}
 */
const SiteTypeEnum = Object.freeze({
  Site: 'site',
  Endpoint: 'endpoint',
});

/**
 * @readonly
 * @enum {string}
 */
const StatusLabelEnum = Object.freeze({
  [StatusEnum.All]: 'All',
  [StatusEnum.Active]: 'Active',
  [StatusEnum.Inactive]: 'Inactive',
  [StatusEnum.Disabled]: 'Disabled',
  [StatusEnum.Disconnected]: 'Disconnected',
  [StatusEnum.Unauthorized]: 'Unauthorized',
  [StatusEnum.Unknown]: 'Unknown',
});

/**
 * @readonly
 * @enum {string}
 */
const DiscoveryConnectStatusLabelEnum = Object.freeze({
  [DiscoveryConnectStatusEnum.All]: 'All',
  [DiscoveryConnectStatusEnum.Connected]: 'Connected',
  [DiscoveryConnectStatusEnum.Pending]: 'Pending',
  [DiscoveryConnectStatusEnum.NotConnected]: 'Not connected',
});

/**
 * @readonly
 * @enum {string}
 */
const DiscoveryDeviceFlagsLabelEnum = Object.freeze({
  [DiscoveryDeviceFlagsEnum.All]: 'All',
  [DiscoveryDeviceFlagsEnum.CanConnect]: 'Can connect',
  [DiscoveryDeviceFlagsEnum.CanAuthenticate]: 'Can authenticate',
  [DiscoveryDeviceFlagsEnum.UnsupportedDevice]: 'Unsupported device',
  [DiscoveryDeviceFlagsEnum.UnsupportedFirmware]: 'Unsupported firmware',
  [DiscoveryDeviceFlagsEnum.MissingCredentials]: 'Missing credentials',
  [DiscoveryDeviceFlagsEnum.Error]: 'Error',
});

/**
 * @readonly
 * @enum {string}
 */
const ServiceEnum = Object.freeze({
  SshServer: 'sshServer',
  NtpClient: 'ntpClient',
  WebServer: 'webServer',
  Discovery: 'discovery',
  SystemLog: 'systemLog',
  TelnetServer: 'telnetServer',
  SNMPAgent: 'snmpAgent',
});

/**
 * @readonly
 * @enum {string}
 */
const ServiceLabelEnum = Object.freeze({
  [ServiceEnum.SshServer]: 'SSH Server',
  [ServiceEnum.NtpClient]: 'NTP Client',
  [ServiceEnum.WebServer]: 'Web Server',
  [ServiceEnum.Discovery]: 'Discovery',
  [ServiceEnum.SystemLog]: 'System Log',
  [ServiceEnum.TelnetServer]: 'Telnet Server',
  [ServiceEnum.SNMPAgent]: 'SNMP Agent',
});

/**
 * @readonly
 * @enum {string}
 */
const EntityEnum = Object.freeze({
  Olt: 'Olt',
  Erouter: 'Erouter',
  Eswitch: 'Eswitch',
  Onu: 'Onu',
  Device: 'Device',
  Backup: 'Backup',
  Site: 'Site',
  Token: 'Token',
  DHCPServer: 'DHCP server',
  DeviceMetadata: 'Device metadata',
});

/**
 * @readonly
 * @enum {string}
 */
const MailServerTypeEnum = Object.freeze({
  NoSmtp: 'nosmtp',
  Cloud: 'cloud',
  Gmail: 'gmail',
  Smtp: 'smtp',
});

/**
 * @readonly
 * @enum {string}
 */
const IpAddressTypeEnum = Object.freeze({
  Dhcp: 'dhcp',
  DhcpV6: 'dhcpv6',
  Static: 'static',
});

/**
 * @readonly
 * @enum {string}
 */
const IpAddressTypeLabelEnum = Object.freeze({
  [IpAddressTypeEnum.Dhcp]: 'Dhcp',
  [IpAddressTypeEnum.DhcpV6]: 'Dhcp v6',
  [IpAddressTypeEnum.Static]: 'Static',
});

/**
 * @readonly
 * @enum {string}
 */
const InterfaceIdentificationTypeEnum = Object.freeze({
  Ethernet: 'eth',
  Switch: 'switch',
  Pon: 'pon',
  Bridge: 'br',
  PPPoE: 'pppoe',
  Vlan: 'vlan',
  Sfp: 'sfp+',
  Wifi: 'wifi',
  Logical: 'ath',
});

/**
 * @readonly
 * @enum {string}
 */
const InterfaceIdentificationTypeLabelEnum = Object.freeze({
  [InterfaceIdentificationTypeEnum.Ethernet]: 'Ethernet',
  [InterfaceIdentificationTypeEnum.Switch]: 'Switch',
  [InterfaceIdentificationTypeEnum.Pon]: 'Pon',
  [InterfaceIdentificationTypeEnum.Bridge]: 'Bridge',
  [InterfaceIdentificationTypeEnum.PPPoE]: 'PPPoE',
  [InterfaceIdentificationTypeEnum.Vlan]: 'VLAN',
});

/**
 * @readonly
 * @enum {string}
 */
const InterfaceSpeedEnum = Object.freeze({
  Auto: 'auto-auto',
  Full10G: '10G',
  Full10000: '10000-full',
  Full1G: '1000',
  Full2500: '2500',
  Full1000: '1000-full',
  Full100: '100-full',
  Half100: '100-half',
  Full10: '10-full',
  Half10: '10-half',
});

/**
 * @readonly
 * @enum {string}
 */
const InterfaceSpeedLabelEnum = Object.freeze({
  [InterfaceSpeedEnum.Auto]: 'Auto negotiation',
  [InterfaceSpeedEnum.Full10G]: '10 Gbps',
  [InterfaceSpeedEnum.Full10000]: '10 Gbps Full',
  [InterfaceSpeedEnum.Full1G]: '1000 Mbps',
  [InterfaceSpeedEnum.Full1000]: '1000 Mbps Full',
  [InterfaceSpeedEnum.Full2500]: '2500 Mbps Full',
  [InterfaceSpeedEnum.Full100]: '100 Mbps Full',
  [InterfaceSpeedEnum.Half100]: '100 Mbps Half',
  [InterfaceSpeedEnum.Full10]: '10 Mbps Full',
  [InterfaceSpeedEnum.Half10]: '10 Mbps Half',
});

const OltSfpInterfaceSpeedEnum = [InterfaceSpeedEnum.Full10G, InterfaceSpeedEnum.Full1G];

const ErouterEthInterfaceSpeedEnum = [
  InterfaceSpeedEnum.Auto, InterfaceSpeedEnum.Full100, InterfaceSpeedEnum.Half100,
  InterfaceSpeedEnum.Full10, InterfaceSpeedEnum.Half10,
];

const ErouterInfinitySfpInterfaceSpeedEnum = [
  InterfaceSpeedEnum.Auto, InterfaceSpeedEnum.Full10000, InterfaceSpeedEnum.Full1000,
];

const ErouterInfinitySubsequentSfpInterfaceSpeedEnum = [
  InterfaceSpeedEnum.Auto,
];

/**
 * @readonly
 * @enum {number}
 */
const InterfaceMaxSpeedEnum = Object.freeze({
  Max10Gb: 10000,
  Max1Gb: 1000,
  Max100Mb: 100,
});

/**
 * @readonly
 * @enum {string}
 */
const PonAuthorizationTypeEnum = Object.freeze({
  NoAuth: 'noauth',
  PSK: 'key',
});

/**
 * @readonly
 * @enum {string}
 */
const PonAuthorizationTypeLabelEnum = Object.freeze({
  [PonAuthorizationTypeEnum.NoAuth]: 'No auth',
  [PonAuthorizationTypeEnum.PSK]: 'Pre-shared secret',
});

/**
 * @readonly
 * @enum {string}
 */
const AlertTypeEnum = Object.freeze({
  None: 'none',
  System: 'system',
  Custom: 'custom',
});

/**
 * @readonly
 * @enum {string}
 */
const IntervalEnum = Object.freeze({
  Hour: 'hour',
  Day: 'day',
  Month: 'month',
  Quarter: 'quarter',
  Year: 'year',
});

/**
 * @readonly
 * @enum {string}
 */
const LogLevelEnum = Object.freeze({
  Info: 'info',
  Warning: 'warning',
  Error: 'error',
});

/**
 * @readonly
 * @enum {string}
 */
const LogTypeEnum = Object.freeze({
  Other: 'other',
  DeviceAppear: 'device-appear',
  DeviceDisappear: 'device-disappear',
  DeviceReappear: 'device-reappear',
  DeviceRamOverLimit: 'device-ram-over-limit',
  DeviceCpuOverLimit: 'device-cpu-over-limit',
  DeviceAuthorize: 'device-authorize',
  DeviceMove: 'device-move',
  DeviceBackupCreate: 'device-backup-create',
  DeviceAutomaticBackupCreate: 'device-automatic-backup-create',
  DeviceBackupApply: 'device-backup-apply',
  DeviceRestart: 'device-restart',
  DeviceDelete: 'device-delete',
  DeviceOutage: 'device-outage',
  DeviceUpgradeStart: 'device-upgrade-start',
  DeviceUpgradeSuccess: 'device-upgrade-success',
  DeviceUpgradeFailed: 'device-upgrade-failed',
  DeviceUpgradeCancel: 'device-upgrade-cancel',
  DeviceConnectionFail: 'device-connection-fail',
  UserLogin: 'user-login',
  UserLoginFail: 'user-login-fail',
  EventNotificationFail: 'event-notification-fail',
  EmailDispatchFail: 'email-dispatch-fail',
  OltGotUnsupportedOnu: 'olt-got-unsupported-onu',
});

/**
 * @readonly
 * @enum {string}
 */
const OutageTypeEnum = Object.freeze({
  Quality: 'quality',
  Outage: 'outage',
});

/**
 * @readonly
 * @enum {string}
 */
const LogTagEnum = Object.freeze({
  Site: 'site',
  Device: 'device',
  Endpoint: 'endpoint',
  Network: 'network',
});

/**
 * @readonly
 * @enum {string}
 */
const DevicePropertyEnum = Object.freeze({
  Cpu: 'CPU',
  Ram: 'RAM',
  NotConnected: 'NotConnected',
});

/**
 * @readonly
 * @enum {string}
 */
const DeviceModelEnum = Object.freeze({
  // - ONU
  NanoG: 'NanoG',
  Loco: 'Loco',

  // - OLT
  UFOLT: 'UF-OLT',
  UFOLT4: 'UF-OLT4',

  // - EdgeRouter
  ERX: 'ER-X',
  ERXSFP: 'ER-X-SFP',
  ERLite3: 'ERLite-3',
  ERPoe5: 'ERPoe-5',
  ERPro8: 'ERPro-8',
  ER8: 'ER-8',
  ER8XG: 'ER-8-XG',
  ER4: 'ER-4',
  ER6P: 'ER-6P',

  // - EdgePoint
  EPR8: 'EP-R8',
  EPR6: 'EP-R6',
  EPS16: 'EP-S16', // switch

  // - EdgeSwitch
  ES12F: 'ES-12F',
  ES16150W: 'ES-16-150W',
  ES24250W: 'ES-24-250W',
  ES24500W: 'ES-24-500W',
  ES24LITE: 'ES-24-Lite',
  ES48500W: 'ES-48-500W',
  ES48750W: 'ES-48-750W',
  ES48LITE: 'ES-48-Lite',
  ES8150W: 'ES-8-150W',
  ES16XG: 'ES-16-XG',

  // - AirCube
  ACBAC: 'ACB-AC',
  ACBISP: 'ACB-ISP',
  ACBLOCO: 'ACB-LOCO',

  /* AirMax */

  // - Rocket
  R2N: 'R2N',
  R2T: 'R2T',
  R5N: 'R5N',
  R6N: 'R6N',
  R36GPS: 'R36-GPS',
  RM3GPS: 'RM3-GPS',
  R2NGPS: 'R2N-GPS',
  R5NGPS: 'R5N-GPS',
  R9NGPS: 'R9N-GPS',
  R5TGPS: 'R5T-GPS',
  RM3: 'RM3',
  R36: 'R36',
  R9N: 'R9N',

  // - NanoStation
  N2N: 'N2N',
  N5N: 'N5N',
  N6N: 'N6N',
  NS3: 'NS3',
  N36: 'N36',
  N9N: 'N9N',
  N9S: 'N9S',
  LM2: 'LM2',
  LM5: 'LM5',

  // - Bullet
  B2N: 'B2N',
  B2T: 'B2T',
  B5N: 'B5N',
  B5T: 'B5T',

  // - AirGrid
  AG2: 'AG2',
  AG2HP: 'AG2-HP',
  AG5: 'AG5',
  AG5HP: 'AG5-HP',
  // - PicoStation
  P2N: 'p2N',
  P5N: 'p5N',

  // - LiteStation
  M25: 'M25',
  // - PowerBeam
  P2B400: 'P2B-400',
  P5B300: 'P5B-300',
  P5B400: 'P5B-400',
  P5B620: 'P5B-620',
  // - LiteBeam
  LB5120: 'LB5-120',
  LB5: 'LB5',
  // - NanoBeam
  N5B: 'N5B',
  N5B16: 'N5B-16',
  N5B19: 'N5B-19',
  N5B300: 'N5B-300',
  N5B400: 'N5B-400',
  N5BClient: 'N5B-Client',
  N2B: 'N2B',
  N2B13: 'N2B-13',
  N2B400: 'N2B-400',
  // - PowerAP
  // supports only 5/10/20/40 channel widths
  PAP: 'PAP',
  // - AirRouter
  LAPHP: 'LAP-HP',
  LAP: 'LAP',
  // - AirGateway
  // supports only 20/40 channel widths
  AGW: 'AGW',
  AGWLR: 'AGW-LR',
  AGWPro: 'AGW-Pro',
  AGWInstaller: 'AGW-Installer',
  // - PowerBridge
  PB5: 'PB5',
  PB3: 'PB3',
  P36: 'P36',
  PBM10: 'PBM10',
  // - NanoBridge
  NB5: 'NB5',
  NB2: 'NB2',
  NB3: 'NB3',
  B36: 'B36',
  NB9: 'NB9',
  // - LiteStation
  SM5: 'SM5',
  // - WispStation
  WM5: 'WM5',
  // - ISO Station
  ISM5: 'IS-M5',

  // AC devices
  // Note that devices with old firmware (5.x and older) will report device Product in the product
  // field instead of board name. This fix is introduced since 7.1.4 beta2.
  // Older 7.x firmware will report short-name which is non unique.
  // NanoStation
  NS5ACL: 'NS-5ACL',
  NS5AC: 'NS-5AC',
  // - Rocket
  R5ACPTMP: 'R5AC-PTMP',
  R5ACPTP: 'R5AC-PTP',
  R5ACLite: 'R5AC-Lite',
  R5ACPRISM: 'R5AC-PRISM',
  R2AC: 'R2AC',
  RP5ACGen2: 'RP-5AC-Gen2',
  // - NanoBeam
  NBE2AC13: 'NBE-2AC-13',
  NBE5AC16: 'NBE-5AC-16',
  NBE5AC19: 'NBE-5AC-19',
  NBE5ACGen2: 'NBE-5AC-Gen2',
  // - PowerBeam
  PBE5AC300: 'PBE-5AC-300',
  PBE5AC300ISO: 'PBE-5AC-300-ISO',
  PBE5AC400: 'PBE-5AC-400',
  PBE5AC400ISO: 'PBE-5AC-400-ISO',
  PBE5AC500: 'PBE-5AC-500',
  PBE5AC500ISO: 'PBE-5AC-500-ISO',
  PBE5AC620: 'PBE-5AC-620',
  PBE5AC620ISO: 'PBE-5AC-620-ISO',
  PBE2AC400: 'PBE-2AC-400',
  PBE2AC400ISO: 'PBE-2AC-400-ISO',
  PBE5ACXGen2: 'PBE-5AC-X-Gen2',
  PBE5ACGen2: 'PBE-5AC-Gen2',
  PBE5ACISOGen2: 'PBE-5AC-ISO-Gen2',
  PBE5AC400ISOGen2: 'PBE-5AC-400-ISO-Gen2',
  // - LiteBeam
  LBE5AC16120: 'LBE-5AC-16-120',
  LBE5AC23: 'LBE-5AC-23',
  LBE5ACGen2: 'LBE-5AC-Gen2',
  // - ISO Station
  IS5AC: 'IS-5AC',
  // - PrismStation
  PS5AC: 'PS-5AC',
});

/**
 * @readonly
 * @enum {string}
 */
const DeviceTypeDetectionEnum = Object.freeze({
  // - ONU
  [DeviceModelEnum.NanoG]: DeviceTypeEnum.Onu,
  [DeviceModelEnum.Loco]: DeviceTypeEnum.Onu,

  // - OLT
  [DeviceModelEnum.UFOLT]: DeviceTypeEnum.Olt,
  [DeviceModelEnum.UFOLT4]: DeviceTypeEnum.Olt,

  // - EdgeRouter
  [DeviceModelEnum.ERX]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ERXSFP]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ERLite3]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ERPoe5]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ERPro8]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ER8]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ER8XG]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ER4]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.ER6P]: DeviceTypeEnum.Erouter,

  // - EdgePoint
  [DeviceModelEnum.EPR8]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.EPR6]: DeviceTypeEnum.Erouter,
  [DeviceModelEnum.EPS16]: DeviceTypeEnum.Eswitch,

  // - EdgeSwitch
  [DeviceModelEnum.ES12F]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES16150W]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES24250W]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES24500W]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES24LITE]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES48500W]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES48750W]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES48LITE]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES8150W]: DeviceTypeEnum.Eswitch,
  [DeviceModelEnum.ES16XG]: DeviceTypeEnum.Eswitch,

  // - AirCube
  [DeviceModelEnum.ACBAC]: DeviceTypeEnum.AirCube,
  [DeviceModelEnum.ACBISP]: DeviceTypeEnum.AirCube,
  [DeviceModelEnum.ACBLOCO]: DeviceTypeEnum.AirCube,

  /* AirMax */

  // - Rocket
  [DeviceModelEnum.R2N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R2T]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R5N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R6N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R36GPS]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.RM3GPS]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R2NGPS]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R5NGPS]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R9NGPS]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R5TGPS]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.RM3]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R36]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R9N]: DeviceTypeEnum.AirMax,
  // - NanoStation
  [DeviceModelEnum.N2N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N5N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N6N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NS3]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N36]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N9N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N9S]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.LM2]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.LM5]: DeviceTypeEnum.AirMax,
  // - Bullet
  [DeviceModelEnum.B2N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.B2T]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.B5N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.B5T]: DeviceTypeEnum.AirMax,
  // - AirGrid
  [DeviceModelEnum.AG2]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.AG2HP]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.AG5]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.AG5HP]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.P2N]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.P5N]: DeviceTypeEnum.AirMax,
  // - LiteStation
  [DeviceModelEnum.M25]: DeviceTypeEnum.AirMax,
  // - PowerBeam
  [DeviceModelEnum.P2B400]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.P5B300]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.P5B400]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.P5B620]: DeviceTypeEnum.AirMax,
  // - LiteBeam
  [DeviceModelEnum.LB5120]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.LB5]: DeviceTypeEnum.AirMax,
  // - NanoBeam
  [DeviceModelEnum.N5B]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N5B16]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N5B19]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N5B300]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N5B400]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N5BClient]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N2B]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N2B13]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.N2B400]: DeviceTypeEnum.AirMax,
  // - PowerAP
  // supports only 5/10/20/40 channel widths
  [DeviceModelEnum.PAP]: DeviceTypeEnum.AirMax,
  // - AirRouter
  [DeviceModelEnum.LAPHP]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.LAP]: DeviceTypeEnum.AirMax,
  // - AirGateway
  // supports only 20/40 channel widths
  [DeviceModelEnum.AGW]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.AGWLR]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.AGWPro]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.AGWInstaller]: DeviceTypeEnum.AirMax,
  // - PowerBridge
  [DeviceModelEnum.PB5]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PB3]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.P36]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBM10]: DeviceTypeEnum.AirMax,
  // - NanoBridge
  [DeviceModelEnum.NB5]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NB2]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NB3]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.B36]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NB9]: DeviceTypeEnum.AirMax,
  // - LiteStation
  [DeviceModelEnum.SM5]: DeviceTypeEnum.AirMax,
  // - WispStation
  [DeviceModelEnum.WM5]: DeviceTypeEnum.AirMax,
  // - ISO Station
  [DeviceModelEnum.ISM5]: DeviceTypeEnum.AirMax,
  // AC devices
  // Note that devices with old firmware (5.x and older) will report device Product in the product
  // field instead of board name. This fix is introduced since 7.1.4 beta2.
  // Older 7.x firmware will report short-name which is non unique.
  // NanoStation
  [DeviceModelEnum.NS5ACL]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NS5AC]: DeviceTypeEnum.AirMax,
  // - Rocket
  [DeviceModelEnum.R5ACPTMP]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R5ACPTP]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R5ACLite]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R5ACPRISM]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.R2AC]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.RP5ACGen2]: DeviceTypeEnum.AirMax,
  // - NanoBeam
  [DeviceModelEnum.NBE2AC13]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NBE5AC16]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NBE5AC19]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.NBE5ACGen2]: DeviceTypeEnum.AirMax,
  // - PowerBeam
  [DeviceModelEnum.PBE5AC300]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC300ISO]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC400]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC400ISO]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC500]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC500ISO]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC620]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC620ISO]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE2AC400]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE2AC400ISO]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5ACXGen2]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5ACGen2]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5ACISOGen2]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.PBE5AC400ISOGen2]: DeviceTypeEnum.AirMax,
  // - LiteBeam
  [DeviceModelEnum.LBE5AC16120]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.LBE5AC23]: DeviceTypeEnum.AirMax,
  [DeviceModelEnum.LBE5ACGen2]: DeviceTypeEnum.AirMax,
  // - ISO Station
  [DeviceModelEnum.IS5AC]: DeviceTypeEnum.AirMax,
  // - PrismStation
  [DeviceModelEnum.PS5AC]: DeviceTypeEnum.AirMax,
});

/**
 * @readonly
 * @enum {string}
 */
const TemperatureTypeEnum = Object.freeze({
  CPU: 'CPU',
  BOARD: 'BOARD',
});

/**
 * @readonly
 * @enum {string}
 */
const PoeOutputEnum = Object.freeze({
  OFF: 'off',
  V24: '24v',
  V48: '48v',
  V24PAIR4: '24v-4pair',
  V54PAIR4: '54v-4pair',
  PASSTHROUGH: 'pthru',
});

/**
 * @readonly
 * @enum {string}
 */
const LogPeriodEnum = Object.freeze({
  [toMs('hour', 1)]: 'Last hour',
  [toMs('hour', 8)]: '8 hours',
  [toMs('day', 1)]: '24 hours',
  [toMs('day', 2)]: '48 hours',
  [toMs('week', 1)]: '7 days',
  [toMs('week', 2)]: '2 weeks',
  [toMs('day', 30)]: '30 days',
});

/**
 * @readonly
 * @enum {string}
 */
const OutagePeriodEnum = Object.freeze({
  [toMs('hour', 1)]: 'Last hour',
  [toMs('hour', 8)]: '8 hours',
  [toMs('day', 1)]: '24 hours',
  [toMs('day', 2)]: '48 hours',
  [toMs('week', 1)]: '7 days',
  [toMs('week', 2)]: '2 weeks',
  [toMs('day', 30)]: '30 days',
});

/**
 * @readonly
 * @enum {string}
 */
const TasksPeriodEnum = Object.freeze({
  [toMs('hour', 1)]: 'Last hour',
  [toMs('hour', 8)]: '8 hours',
  [toMs('day', 1)]: '24 hours',
  [toMs('day', 2)]: '48 hours',
  [toMs('week', 1)]: '7 days',
  [toMs('week', 2)]: '2 weeks',
  [toMs('day', 30)]: '30 days',
});

/**
 * @readonly
 * @enum {string}
 */
const SystemLogLevelEnum = Object.freeze({
  Emergency: 'emerg',
  Alert: 'alert',
  Critical: 'crit',
  Error: 'err',
  Warning: 'warning',
  Notice: 'notice',
  Info: 'info',
  Debug: 'debug',
});

/**
 * @readonly
 * @enum {string}
 */
const DhcpLeaseTypeEnum = Object.freeze({
  Static: 'static',
  Dynamic: 'dynamic',
});

/**
 * @readonly
 * @enum {string}
 */
const ProgressStatusEnum = Object.freeze({
  Success: 'success',
  Failed: 'failed',
  InProgress: 'in-progress',
  Canceled: 'canceled',
});

/**
 * @type {Object.<string, string>}
 */
const ProgressStatusLabelEnum = Object.freeze({
  [ProgressStatusEnum.InProgress]: 'In progress',
  [ProgressStatusEnum.Success]: 'Success',
  [ProgressStatusEnum.Failed]: 'Failed',
  [ProgressStatusEnum.Canceled]: 'Canceled',
});

/**
 * NOTE: Used as a part of the file path and url, use only friendly ascii characters.
 * @readonly
 * @enum {string}
 */
const FirmwareOriginEnum = Object.freeze({
  UBNT: 'ubnt',
  Manual: 'manual',
  UNMS: 'unms',
});

/**
 * @readonly
 * @enum {string}
 */
const FirmwarePlatformIdEnum = Object.freeze({
  // ONU
  NanoG: 'SFU',
  Loco: 'UF_LOCO',

  // edgeOs
  E50: 'e50',
  E100: 'e100',
  E200: 'e200',
  E300: 'e300',
  E600: 'e600',
  E1000: 'e1000',

  // eswitch
  ESWH: 'eswh',
  ESGH: 'esgh',

  // airCube
  ACB: 'ACB',

  // airOS
  WA: 'WA',
  WA2: '2WA',
  XC: 'XC',
  XC2: '2XC',
  XW: 'XW',
  XM: 'XM',
  TI: 'TI',

  // not supported
  AirGW: 'AirGW',
  AirGWP: 'AirGWP',
});

/**
 * Must match the DB enum!
 *
 * @readonly
 * @enum {string}
 */
const TaskStatusEnum = Object.freeze({
  Success: 'success',
  Failed: 'failed',
  InProgress: 'in-progress',
  Canceled: 'canceled',
  Queued: 'queued',
});

/**
 * @readonly
 * @enum {string}
 */
const TaskStatusLabelEnum = Object.freeze({
  [TaskStatusEnum.InProgress]: 'In progress',
  [TaskStatusEnum.Success]: 'Completed',
  [TaskStatusEnum.Failed]: 'Failed',
  [TaskStatusEnum.Canceled]: 'Canceled',
  [TaskStatusEnum.Queued]: 'Queued',
});

/**
 * Must match the DB enum!
 *
 * @readonly
 * @enum {string}
 */
const TaskTypeEnum = Object.freeze({
  FirmwareUpgrade: 'firmware-upgrade',
});

/**
 * @type {Object.<string, string>}
 */
const TaskTypeLabelEnum = Object.freeze({
  [TaskTypeEnum.FirmwareUpgrade]: 'Firmware Upgrade',
});

/**
 * @readonly
 * @type {Object}
 */
const WebSocketProtocolEnum = Object.freeze({
  V1: 'unms',
  V2: 'unms2',
});

const EncodingEnum = Object.freeze({
  BASE64: 'base64',
  HEX: 'hex',
  UTF_8: 'utf-8',
});

/**
 * @readonly
 * @enum {string}
 */
const SmtpSecurityModeEnum = Object.freeze({
  PlainText: 'Plain text',
  SSL: 'SSL',
  TLS: 'TLS',
  TLSIfAvailable: 'TLS if available',
});

/**
 * @readonly
 * @enum {string}
 */
const SmtpSecurityModePortEnum = Object.freeze({
  [SmtpSecurityModeEnum.PlainText]: 25,
  [SmtpSecurityModeEnum.SSL]: 465,
  [SmtpSecurityModeEnum.TLS]: 587,
  [SmtpSecurityModeEnum.TLSIfAvailable]: 587,
});

/**
 * @readonly
 * @enum {string}
 */
const DeviceTransmissionProfileEnum = Object.freeze({
  Minimal: 'minimal',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
});


const DeviceTransmissionProfileLabelEnum = Object.freeze({
  [DeviceTransmissionProfileEnum.Minimal]: 'Minimal',
  [DeviceTransmissionProfileEnum.Low]: 'Low',
  [DeviceTransmissionProfileEnum.Medium]: 'Medium',
  [DeviceTransmissionProfileEnum.High]: 'High',
});

const DeviceTransmissionProfileSettingsEnum = Object.freeze({
  [DeviceTransmissionProfileEnum.Minimal]: {
    eventIntervalLimits: {
      interfaces: toMs('minutes', 2),
      'config-change': 1,
      '*': toMs('seconds', 24),
    },
    socketRPCPingInterval: toMs('seconds', 15),
    socketRPCPGetOnuListInterval: toMs('minutes', 2),
    airMaxUpdateInterval: toMs('minutes', 2),
    airMaxCompleteUpdateInterval: toMs('hours', 2),
    airCubeUpdateInterval: toMs('minutes', 2),
  },
  [DeviceTransmissionProfileEnum.Low]: {
    eventIntervalLimits: {
      interfaces: toMs('minutes', 1),
      'config-change': 1,
      '*': toMs('seconds', 12),
    },
    socketRPCPingInterval: toMs('seconds', 10),
    socketRPCPGetOnuListInterval: toMs('minutes', 1),
    airMaxUpdateInterval: toMs('minutes', 1),
    airMaxCompleteUpdateInterval: toMs('hours', 1),
    airCubeUpdateInterval: toMs('minutes', 1),
  },
  [DeviceTransmissionProfileEnum.Medium]: {
    eventIntervalLimits: {
      interfaces: toMs('seconds', 15),
      'config-change': 1,
      '*': toMs('seconds', 5),
    },
    socketRPCPingInterval: toMs('seconds', 10),
    socketRPCPGetOnuListInterval: toMs('seconds', 30),
    airMaxUpdateInterval: toMs('seconds', 15),
    airMaxCompleteUpdateInterval: toMs('hours', 1),
    airCubeUpdateInterval: toMs('seconds', 15),
  },
  [DeviceTransmissionProfileEnum.High]: {
    eventIntervalLimits: {
      interfaces: toMs('seconds', 3),
      'config-change': 1,
      '*': toMs('seconds', 2),
    },
    socketRPCPingInterval: toMs('seconds', 4),
    socketRPCPGetOnuListInterval: toMs('seconds', 9),
    airMaxUpdateInterval: toMs('seconds', 6),
    airMaxCompleteUpdateInterval: toMs('minutes', 30),
    airCubeUpdateInterval: toMs('seconds', 6),
  },
});

const TableTypeEnum = Object.freeze({
  DeviceList: 'deviceList',
  EndpointList: 'endpointList',
  SiteList: 'siteList',
  FirmwareList: 'firmwareList',
  DiscoveryDeviceList: 'discoveryDeviceList',
  DeviceBackupList: 'deviceBackupList',
  DeviceInterfaceList: 'deviceInterfaceList',
  ErouterStaticRouteList: 'erouterStaticRouteList',
  ErouterOspfRouteAreaList: 'erouterOspfRouteAreaList',
  ErouterOspfRouteInterfaceList: 'erouterOspfRouteInterfaceList',
  ErouterDhcpLeaseList: 'erouterDhcpLeaseList',
  ErouterDhcpServerList: 'erouterDhcpServerList',
  DeviceLogList: 'deviceLogList',
  DeviceOutageList: 'deviceOutageList',
  AirMaxStationList: 'airMaxStationList',
  AircubeStationList: 'aircubeStationList',
  SiteDeviceList: 'siteDeviceList',
  SiteEndpointList: 'siteEndpointList',
  OltOnuList: 'oltOnuList',
  OltOnuProfileList: 'oltOnuProfileList',
  FirmwareUpgradeModalDeviceList: 'FirmwareUpgradeModalDeviceList',
  OutagesPopoverList: 'OutagesPopoverList',
  LogsPopoverList: 'LogsPopoverList',
  TaskManagerPopoverTableList: 'TaskManagerPopoverTableList',
  TaskManagerPopoverDetailList: 'TaskManagerPopoverDetailList',
});

/**
 * @readonly
 * @enum {string}
 */
const MacAesKeyExchangeStatusEnum = Object.freeze({
  Pending: 'pending',
  Complete: 'complete',
});

const OnuModeEnum = Object.freeze({
  Bridge: 'bridge',
  Router: 'router',
});

const OnuModeLabelEnum = Object.freeze({
  [OnuModeEnum.Bridge]: 'Bridge',
  [OnuModeEnum.Router]: 'Router',
});

const DeviceStateEnum = Object.freeze({
  Enabled: 'enabled',
  Disabled: 'disabled',
});

const DeviceStateLabelEnum = Object.freeze({
  [DeviceStateEnum.Enabled]: 'Enabled',
  [DeviceStateEnum.Disabled]: 'Disabled',
});

const MapsProviderEnum = Object.freeze({
  GoogleMaps: 'GoogleMaps',
  OpenStreetMap: 'OpenStreetMap',
});

const GoogleMapsElevationStatusEnum = Object.freeze({
  OK: 'OK',
  INVALID_REQUEST: 'INVALID_REQUEST',
  OVER_QUERY_LIMIT: 'OVER_QUERY_LIMIT',
  REQUEST_DENIED: 'REQUEST_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
});

/**
 * @readonly
 * @enum {string}
 */
const DataLinkOriginEnum = Object.freeze({
  Unms: 'unms',
  Manual: 'manual',
});

/**
 * @readonly
 * @enum {string}
 */
const MobileDevicePlatformEnum = Object.freeze({
  Ios: 'ios',
  Android: 'android',
});

/**
 * @readonly
 * @enum {string}
 */
const MobileDevicePlatformLabelEnum = Object.freeze({
  [MobileDevicePlatformEnum.Ios]: 'iOS',
  [MobileDevicePlatformEnum.Android]: 'Android',
});

/**
 * @readonly
 * @enum {string}
 */
const UserRoleEnum = Object.freeze({
  Admin: 'admin',
  Guest: 'guest',
  Anonymous: 'anonymous',
});

/**
 * @readonly
 * @enum {string}
 */
const WirelessModeEnum = Object.freeze({
  Ap: 'ap',
  ApPtp: 'ap-ptp',
  ApPtmp: 'ap-ptmp',
  ApPtmpAirmaxMixed: 'ap-ptmp-airmax-mixed',
  ApPtmpAirmaxAc: 'ap-ptmp-airmax-ac',
  Sta: 'sta',
  StaPtp: 'sta-ptp',
  StaPtmp: 'sta-ptmp',
  ApRep: 'aprepeater',
  Mesh: 'mesh',
});

/**
 * @readonly
 * @enum {string}
 */
const WirelessModeLabelEnum = Object.freeze({
  [WirelessModeEnum.Ap]: 'Access Point',
  [WirelessModeEnum.ApPtp]: 'AP PtP',
  [WirelessModeEnum.ApPtmp]: 'AP PtMP',
  [WirelessModeEnum.ApPtmpAirmaxMixed]: 'AP PtMP airMAX Mixed',
  [WirelessModeEnum.ApPtmpAirmaxAc]: 'AP PtMP airMAX AC',
  [WirelessModeEnum.Sta]: 'Station',
  [WirelessModeEnum.StaPtp]: 'Station PtP',
  [WirelessModeEnum.StaPtmp]: 'Station PtMP',
  [WirelessModeEnum.ApRep]: 'AP Repeater',
  [WirelessModeEnum.Mesh]: 'Mesh',
});

const FrequencyRangeEnum = Object.freeze({
  Wifi2GHz: '2.4GHz',
  Wifi3GHz: '3GHz',
  Wifi4GHz: '4GHz',
  Wifi5GHz: '5GHz',
  Wifi11GHz: '11GHz',
  Wifi24GHz: '24GHz',
});

const WifiModeEnum = Object.freeze({
  AP: 'ap',
  Mesh: 'mesh',
});

const WifiModeLabelEnum = Object.freeze({
  [WifiModeEnum.AP]: 'AP',
  [WifiModeEnum.Mesh]: 'Mesh',
});

const WifiSecurityEnum = Object.freeze({
  WEP: 'wep',
  WPA: 'wpa',
  WPA2: 'wpa2',
});

const WifiSecurityLabelEnum = Object.freeze({
  [WifiSecurityEnum.WEP]: 'WEP',
  [WifiSecurityEnum.WPA]: 'WPA',
  [WifiSecurityEnum.WPA2]: 'WPA2',
});

const WifiAuthenticationEnum = Object.freeze({
  PSK: 'psk',
  Enterprise: 'ent',
});

const WifiAuthenticationLabelEnum = Object.freeze({
  [WifiAuthenticationEnum.PSK]: 'PSK',
  [WifiAuthenticationEnum.Enterprise]: 'Enterprise',
});

const NewsTypeEnum = Object.freeze({
  Info: 'info',
  Warning: 'warning',
  Danger: 'danger',
});

const AirCubeTxPowerEnum = Object.freeze({
  High: 22,
  Auto: 20,
  Medium: 12,
  Low: 5,
});

const AirCubeTxPowerLabelEnum = Object.freeze({
  [AirCubeTxPowerEnum.High]: 'High',
  [AirCubeTxPowerEnum.Auto]: 'Auto',
  [AirCubeTxPowerEnum.Medium]: 'Medium',
  [AirCubeTxPowerEnum.Low]: 'Low',
});

module.exports = {
  AlertTypeEnum,
  AirCubeTxPowerEnum,
  AirCubeTxPowerLabelEnum,
  AirMaxSeriesEnum,
  DataLinkOriginEnum,
  DeviceCategoryEnum,
  DeviceModelEnum,
  DevicePropertyEnum,
  DeviceTypeDetectionEnum,
  DeviceTypeEnum,
  DeviceTypeApiRouteEnum,
  DeviceTransmissionProfileEnum,
  DeviceTransmissionProfileLabelEnum,
  DeviceTransmissionProfileSettingsEnum,
  DhcpLeaseTypeEnum,
  DiscoveryConnectProgressEnum,
  DiscoveryConnectStatusEnum,
  DiscoveryConnectStatusLabelEnum,
  DiscoveryDeviceFlagsEnum,
  DiscoveryDeviceFlagsLabelEnum,
  DiscoveryMethodEnum,
  EncodingEnum,
  EntityEnum,
  ErouterEthInterfaceSpeedEnum,
  ErouterInfinitySfpInterfaceSpeedEnum,
  ErouterInfinitySubsequentSfpInterfaceSpeedEnum,
  FirmwareOriginEnum,
  FirmwarePlatformIdEnum,
  GoogleMapsElevationStatusEnum,
  MapsProviderEnum,
  InterfaceIdentificationTypeEnum,
  InterfaceIdentificationTypeLabelEnum,
  InterfaceMaxSpeedEnum,
  InterfaceSpeedEnum,
  InterfaceSpeedLabelEnum,
  IntervalEnum,
  IpAddressTypeEnum,
  IpAddressTypeLabelEnum,
  LogLevelEnum,
  LogPeriodEnum,
  LogTagEnum,
  LogTypeEnum,
  MailServerTypeEnum,
  MacAesKeyExchangeStatusEnum,
  NewsTypeEnum,
  NmsUpdateStatusEnum,
  OltSfpInterfaceSpeedEnum,
  OspfAreaTypeEnum,
  OspfAreaTypeLabelEnum,
  OspfAuthTypeEnum,
  OspfAuthTypeLabelEnum,
  OutagePeriodEnum,
  OutageTypeEnum,
  PoeOutputEnum,
  PonAuthorizationTypeEnum,
  PonAuthorizationTypeLabelEnum,
  ProgressStatusEnum,
  ProgressStatusLabelEnum,
  RouteGatewayStatusEnum,
  RouteGatewayStatusLabelEnum,
  RouteTypeEnum,
  RouteTypeLabelEnum,
  ServiceEnum,
  ServiceLabelEnum,
  SiteTypeEnum,
  SmtpSecurityModeEnum,
  SmtpSecurityModePortEnum,
  StaticRouteTypeEnum,
  StaticRouteTypeLabelEnum,
  StatusEnum,
  StatusLabelEnum,
  SystemLogLevelEnum,
  TableTypeEnum,
  TasksPeriodEnum,
  TaskStatusEnum,
  TaskStatusLabelEnum,
  TaskTypeEnum,
  TaskTypeLabelEnum,
  TemperatureTypeEnum,
  TimezoneListEnum,
  WebSocketProtocolEnum,
  OnuModeEnum,
  OnuModeLabelEnum,
  DeviceStateEnum,
  DeviceStateLabelEnum,
  DeviceConnectionFailedReasonEnum,
  DateFormatEnum,
  TimeFormatEnum,
  MobileDevicePlatformEnum,
  MobileDevicePlatformLabelEnum,
  UserRoleEnum,
  WirelessModeEnum,
  WirelessModeLabelEnum,
  FrequencyRangeEnum,
  WifiModeEnum,
  WifiModeLabelEnum,
  WifiSecurityEnum,
  WifiSecurityLabelEnum,
  WifiAuthenticationEnum,
  WifiAuthenticationLabelEnum,
};
