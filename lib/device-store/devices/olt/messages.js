'use strict';

const { partial, omitBy } = require('lodash/fp');
const { isNilOrEmpty } = require('ramda-adjunct');

const { rpcRequest } = require('../../backends/ubridge/messages');
const { MessageNameEnum } = require('../../backends/vyatta/enums');

const subscribeEventsRequest = partial(rpcRequest, [
  {
    SUBSCRIBE: [
      { name: 'interfaces' },
      { name: 'system-stats' },
      { name: 'config-change' },
      { name: 'pon-stats' },
    ],
  },
  'subscribeEvents',
  'sys',
]);

const setOnuConfigRequest = (setData, deleteData) => {
  const request = omitBy(isNilOrEmpty, { SET_ONUCFG: setData, DELETE_ONUCFG: deleteData });

  return rpcRequest(request, MessageNameEnum.SetOnuConfig, 'sys');
};

module.exports = {
  subscribeEventsRequest,
  setOnuConfigRequest,
};
