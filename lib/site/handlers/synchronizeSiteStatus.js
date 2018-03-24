'use strict';

const { Reader: reader } = require('monet');
const { getOr } = require('lodash/fp');

/**
 * @param {CorrespondenceDevice} device
 * @param {Message} message
 * @return {Reader.<synchronizeSiteHandler~callback>}
 */
module.exports = ({ device }, message) => reader(
  /**
   * @function synchronizeSiteHandler
   * @param {MessageHub} messageHub
   * @param {SiteService} site
   * @return {Promise}
   */
  ({ messageHub, site }) => {
    const siteId = getOr(null, ['identification', 'siteId'], device);

    if (siteId !== null) {
      site.synchronizeSiteStatus(siteId)
        .catch(messageHub.logError(message));
    }
  }
);
