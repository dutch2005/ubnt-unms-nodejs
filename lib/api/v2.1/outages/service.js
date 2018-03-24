'use strict';

const { Reader: reader } = require('monet');
const { keyBy, map, get, compact } = require('lodash/fp');

const { allP, resolveP, rejectP } = require('../../../util');
const { toApiOutageView } = require('../../../transformers/outage');
const { safeParseOutageView } = require('../../../transformers/outage/parsers');


const outageItemList = (outagesParams, aggsParams) => reader(
  ({ DB, dal, outages }) => {
    const dbOutageItemListP = dal.outageRepository.findAllByRequestParams(outagesParams);
    const dbOutageAggregationItemListP = dal.outageRepository.findAggsByRequestParams(aggsParams);
    const siteMapP = DB.site.list().then(keyBy('id'));
    const outageIdsInProgress = map(get('id'), outages.getOutages());
    const dbDeviceMetadataListP = dbOutageItemListP
      .then(map(get(['device', 'id'])))
      .then(compact)
      .then(deviceIds => dal.deviceMetadataRepository.findAll({ where: { id: { $in: deviceIds } } }));

    return allP([dbOutageItemListP, dbOutageAggregationItemListP, siteMapP, dbDeviceMetadataListP])
      .then(([dbOutageItemList, dbOutageAggregationItemList, siteMap, dbDeviceMetadataList]) =>
        safeParseOutageView(
          {
            outageIdsInProgress,
            siteMap,
            dbOutageAggregationItemList,
            dbDeviceMetadataList,
            type: outagesParams.type,
            limit: outagesParams.limit,
            currentPage: outagesParams.page,
          },
          dbOutageItemList
        )
        .chain(toApiOutageView)
        .cata(rejectP, resolveP)
      );
  }
);

const countUnread = ({ timestamp }) => reader(
  ({ dal }) => dal.outageRepository.countUnread(timestamp)
);


module.exports = {
  outageItemList,
  countUnread,
};
