'use strict';

const config = require('../../../../config');

const getSiteImagesDir = sideId =>
  `${config.siteImages.imagesDir}/${sideId}`;

const getSiteImagesRelativePath = (sideId, fileId, isThumb = false) =>
  `${sideId}/${fileId}${isThumb ? '_thumb' : ''}.jpg`;

// TODO(michal.sedlak@ubnt.com): Add '.jpg' suffix when moving galleries to PG
const getSiteImagesFileUrl = (sideId, fileId, isThumb = false) =>
  `${config.siteImages.imagesUrl}/${getSiteImagesRelativePath(sideId, fileId, isThumb)}`;

const getSiteImagesFilePath = (sideId, fileId, isThumb = false) =>
  `${config.siteImages.imagesDir}/${getSiteImagesRelativePath(sideId, fileId, isThumb)}`;


module.exports = {
  getSiteImagesDir,
  getSiteImagesFileUrl,
  getSiteImagesFilePath,
};
