'use strict';

const { Reader: reader } = require('monet');
const { constant } = require('lodash/fp');

const { SiteTypeEnum } = require('../../../enums');
const { entityExistsCheck, tapP, readFile, allP } = require('../../../util');
const { getSiteImagesFilePath } = require('./util');

/**
 * Return site image file
 */

const getSiteImage = (siteId, imageId) => reader(
  ({ DB }) => {
    const dbSitePromise = DB.site.findById(siteId)
       .then(tapP(entityExistsCheck(SiteTypeEnum.Site)));
    const dbImagePromise = DB.site.findImageById(siteId, imageId)
      .then(tapP(entityExistsCheck('siteImage')));

    return allP([dbSitePromise, dbImagePromise])
      .then(constant(getSiteImagesFilePath(siteId, imageId)))
      .then(readFile);
  }
);

module.exports = {
  getSiteImage,
};

