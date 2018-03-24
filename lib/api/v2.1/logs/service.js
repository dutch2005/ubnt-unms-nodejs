'use strict';

const { Reader: reader } = require('monet');
const { map, get, compact } = require('lodash/fp');

const { allP, resolveP, rejectP } = require('../../../util');
const { toApiLogView } = require('../../../transformers/log');
const { safeParseLogView } = require('../../../transformers/log/parsers');


const logItemList = (logsParams, aggsParams) => reader(
  ({ dal }) => {
    const dbLogItemListP = dal.logRepository.findAllByRequestParams(logsParams);
    const dbLogAggregationItemListP = dal.logRepository.findAggsByRequestParams(aggsParams);
    const dbDeviceMetadataListP = dbLogItemListP
      .then(map(get(['device', 'id'])))
      .then(compact)
      .then(deviceIds => dal.deviceMetadataRepository.findAll({ where: { id: { $in: deviceIds } } }));

    return allP([dbLogItemListP, dbLogAggregationItemListP, dbDeviceMetadataListP])
      .then(([dbLogItemList, dbLogAggregationItemList, dbDeviceMetadataList]) =>
        safeParseLogView(
          {
            dbLogAggregationItemList,
            dbDeviceMetadataList,
            level: logsParams.level,
            limit: logsParams.limit,
            currentPage: logsParams.page,
          },
          dbLogItemList
        )
          .chain(toApiLogView)
          .cata(rejectP, resolveP)
      );
  }
);

const countUnread = ({ timestamp, level }) => reader(
  ({ dal }) => dal.logRepository.countUnread({ timestamp, level })
);


module.exports = {
  logItemList,
  countUnread,
};
