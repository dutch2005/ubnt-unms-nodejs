'use strict';

const { Observable } = require('rxjs/Rx');
const { partial, isUndefined, merge } = require('lodash/fp');
const { mapObjIndexed } = require('ramda');

const { pingStatsRequest } = require('../../../backends/ubridge/messages');
const { ubusRequest } = require('../../../backends/openwrt/messages');
const { mergeDeviceUpdate } = require('../../../../transformers/device/mergers');
const parsers = require('../transformers/device/parsers');

const systemRequest = partial(ubusRequest, [[
  {
    id: 'hwSystemBoard',
    path: 'system',
    method: 'board',
    args: {},
  },
  {
    id: 'hwSystemInfo',
    path: 'system',
    method: 'info',
    args: {},
  },
  {
    id: 'hwInterfaceList',
    path: 'network.device',
    method: 'status',
    args: {},
  },
]]);

const parseHwSystemBoard = partial(parsers.parseHwSystemBoard, [{}]);
const parseHwSystemInfo = partial(parsers.parseHwSystemInfo, [{}]);
const parseHwDeviceStatistics = partial(parsers.parseHwDeviceStatistics, [{}]);

const getSpeed = (oldBytes, newBytes, timeElapsed) => {
  let bytesTransferred;

  if (oldBytes > newBytes) {
    bytesTransferred = newBytes + (0xFFFFFFFF - oldBytes);
  } else {
    bytesTransferred = newBytes - oldBytes;
  }

  return Math.floor((bytesTransferred * 8) / (timeElapsed / 1000));
};

class AirCubePeriodicEventsMiddleware {
  constructor(messageHub, periodicActions, cmDevice, commDevice) {
    this.deviceId = commDevice.deviceId;
    this.commDevice = commDevice;
    this.cmDevice = cmDevice;
    this.periodicActions = periodicActions;
    this.messageHub = messageHub;

    this.interfaceStats = {
      lastSeen: 0,
      stats: {},
    };
  }

  appendThroughput(hwInterfaceList) {
    const ts = Date.now();
    const timeElapsed = ts - this.interfaceStats.lastSeen;

    this.interfaceStats.lastSeen = ts;

    return mapObjIndexed((intfc, interfaceName) => {
      const newStats = {
        rxbytes: intfc.statistics.rx_bytes,
        txbytes: intfc.statistics.tx_bytes,
      };

      let oldStats = this.interfaceStats.stats[interfaceName];

      if (isUndefined(oldStats)) {
        oldStats = newStats;
      }

      this.interfaceStats.stats[interfaceName] = newStats;

      return merge(intfc, {
        statistics: {
          custom_tx_throughput: getSpeed(oldStats.txbytes, newStats.txbytes, timeElapsed),
          custom_rx_throughput: getSpeed(oldStats.rxbytes, newStats.rxbytes, timeElapsed),
        },
      });
    }, hwInterfaceList);
  }

  notifyDeviceUpdate(cmDeviceUpdate) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.airCubeUpdateEvent(this.deviceId, cmDeviceUpdate));
  }

  notifyStats(cmStats) {
    const messages = this.messageHub.messages;
    this.messageHub.publish(messages.airCubeStatisticsEvent(this.deviceId, cmStats));
  }

  updateAction() {
    return Observable.forkJoin(
      this.connection.rpc(pingStatsRequest()),
      this.connection.rpc(systemRequest()),
      this.commDevice.buildDevice({})
    )
      .do(([hwPingStats, hwSystem, cmACB]) => {
        const { hwSystemBoard, hwSystemInfo, hwWirelessStatus } = hwSystem.data;
        const hwInterfaceList = this.appendThroughput(hwSystem.data.hwInterfaceList);

        const cmStats = parseHwDeviceStatistics({ hwPingStats, hwInterfaceList, hwSystemInfo, hwWirelessStatus });
        const cmDeviceUpdate = mergeDeviceUpdate(
          cmACB,
          parseHwSystemBoard(hwSystemBoard),
          parseHwSystemInfo(hwSystemInfo),
          parsers.parseHwDeviceInterfaces(hwInterfaceList)
        );

        this.notifyStats(cmStats);
        this.notifyDeviceUpdate(cmDeviceUpdate);
      })
      .catch(error => this.connection.handleError(error, true));
  }

  setupPeriodicActions() {
    const updateAction = this.updateAction.bind(this);

    this.periodicActions.schedule(this.deviceId, updateAction, 'airCubeUpdateInterval');
  }

  handleEstablish(connection) {
    const messages = this.messageHub.messages;
    this.connection = connection;

    return Observable.defer(() => this.messageHub.publishAndConfirm(messages.airCubeRegisterEvent(this.cmDevice)))
      .do(() => {
        this.cmDevice = null;
        this.setupPeriodicActions();
      });
  }

  handleClose() {
    const messages = this.messageHub.messages;
    const deviceId = this.deviceId;

    this.periodicActions.stop(deviceId);
    this.messageHub.publish(messages.airCubeCloseEvent(deviceId));
  }
}

const createMiddleware = ({ messageHub, periodicActions, cmAirCube, commDevice }) =>
  new AirCubePeriodicEventsMiddleware(messageHub, periodicActions, cmAirCube, commDevice);

module.exports = createMiddleware;
