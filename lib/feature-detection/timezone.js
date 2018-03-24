'use strict';

const moment = require('moment-timezone');

const { DeviceTypeEnum } = require('../enums');
const erouterTimezoneList = require('./timezone/erouter');
const oltTimezoneList = require('./timezone/erouter');

const timezoneList = moment.tz.names();


const getTimezoneListByDeviceType = (type) => {
  switch (type) {
    case DeviceTypeEnum.Erouter: return erouterTimezoneList;
    case DeviceTypeEnum.Olt: return oltTimezoneList;
    default: return timezoneList;
  }
};


module.exports = {
  getTimezoneListByDeviceType,
};
