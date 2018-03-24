'use strict';

const { lensPath, view, compose } = require('ramda');
const { pick, defaultTo } = require('lodash/fp');

const { isNotEqual, isNotEmpty } = require('../../util');


const descriptionLens = lensPath(['identification', 'description']);
const speedLens = lensPath(['speed']);
const mtuLens = lensPath(['mtu']);
const proxyARPLens = lensPath(['proxyARP']);
const poeLens = lensPath(['poe']);
const addressesLens = lensPath(['addresses']);
const switchLens = lensPath(['switch']);
const pppoeLens = lensPath(['pppoe']);
const ponLens = lensPath(['pon']);
const bridgeLens = lensPath(['bridge']);
const bridgePortsLens = compose(bridgeLens, lensPath(['ports']));
const ospfLens = lensPath(['ospf']);

/**
 * @typedef {Object} HwInterfaceInstructionsDescriptor
 * @property {string} [description]
 * @property {string} [speed]
 * @property {number} [mtu]
 * @property {boolean} [proxyARP]
 * @property {?boolean} [poe]
 * @property {Array.<Object>} [addresses]
 * @property {Object} [switch]
 * @property {Object} [pppoe]
 * @property {{settings: Object, ports: Array.<Object>} [bridge]
 */


/**
 * Computes diff for two correspondence objects in API update context.
 *
 * @param {!Object} pristineCorrespondenceData
 * @param {!Object} dirtyCorrespondenceData
 * @sig (Correspondence a, Correspondence b) => (a, b) -> HwInterfaceInstructionsDescriptor
 * @return {!HwInterfaceInstructionsDescriptor}
 */

const update = (pristineCorrespondenceData, dirtyCorrespondenceData) => {
  /**
   * @type HwInterfaceInstructionsDescriptor
   */
  const hwInterfaceInstructionsDescriptor = {};

  /**
   * Description change detection.
   */
  {
    const descriptionOld = view(descriptionLens, pristineCorrespondenceData);
    const descriptionNew = view(descriptionLens, dirtyCorrespondenceData);
    const hasChanged = descriptionOld !== descriptionNew;

    if (hasChanged) { hwInterfaceInstructionsDescriptor.description = descriptionNew }
  }

  /**
   * Speed change detection.
   */
  {
    const speedOld = view(speedLens, pristineCorrespondenceData);
    const speedNew = view(speedLens, dirtyCorrespondenceData);
    const hasChanged = speedOld !== speedNew;

    if (hasChanged) { hwInterfaceInstructionsDescriptor.speed = speedNew }
  }

  /**
   * Mtu change detection.
   */
  {
    const mtuOld = view(mtuLens, pristineCorrespondenceData);
    const mtuNew = view(mtuLens, dirtyCorrespondenceData);
    const hasChanged = mtuOld !== mtuNew;

    if (hasChanged) { hwInterfaceInstructionsDescriptor.mtu = parseInt(mtuNew, 10) }
  }

  /**
   * Proxy ARP change detection.
   */
  {
    const proxyARPOld = view(proxyARPLens, pristineCorrespondenceData);
    const proxyARPNew = view(proxyARPLens, dirtyCorrespondenceData);
    const hasChanged = proxyARPOld !== proxyARPNew;

    if (hasChanged) { hwInterfaceInstructionsDescriptor.proxyARP = proxyARPNew }
  }

  /**
   * Poe change detection.
   */
  {
    const poeOld = view(poeLens, pristineCorrespondenceData);
    const poeNew = view(poeLens, dirtyCorrespondenceData);
    const hasChanged = isNotEqual(poeOld, poeNew);

    if (hasChanged) { hwInterfaceInstructionsDescriptor.poe = poeNew }
  }

  /**
   * IP address change detection.
   */
  {
    const addressesOld = view(addressesLens, pristineCorrespondenceData);
    const addressesNew = view(addressesLens, dirtyCorrespondenceData);
    const hasChanged = isNotEqual(addressesOld, addressesNew);

    if (hasChanged) { hwInterfaceInstructionsDescriptor.addresses = addressesNew }
  }

  /**
   * Switch change detection.
   */
  {
    const switchOld = view(switchLens, pristineCorrespondenceData);
    const switchNew = view(switchLens, dirtyCorrespondenceData);
    const hasChanged = isNotEqual(switchOld, switchNew);

    if (hasChanged) { hwInterfaceInstructionsDescriptor.switch = switchNew }
  }

  /**
   * PPPoE change detection.
   */
  {
    const pppoeOld = view(pppoeLens, pristineCorrespondenceData);
    const pppoeNew = view(pppoeLens, dirtyCorrespondenceData);
    const hasChanged = isNotEqual(pppoeOld, pppoeNew);

    if (hasChanged) { hwInterfaceInstructionsDescriptor.pppoe = pppoeNew }
  }

  /**
   * PON authentication change detection.
   */
  {
    const ponOld = view(ponLens, pristineCorrespondenceData);
    const ponNew = view(ponLens, dirtyCorrespondenceData);
    const hasChanged = isNotEqual(ponOld, ponNew);

    if (hasChanged) { hwInterfaceInstructionsDescriptor.pon = ponNew }
  }

  /**
   * Bridge change detection.
   */
  {
    const bridgeOld = view(bridgeLens, pristineCorrespondenceData);
    const bridgeNew = view(bridgeLens, dirtyCorrespondenceData);
    const changeSet = {};
    /**
     * Bridge settings change detection.
     */
    {
      const settingsOld = pick(['priority', 'forwardingDelay', 'helloTime', 'maxAge', 'stp'], bridgeOld);
      const settingsNew = pick(['priority', 'forwardingDelay', 'helloTime', 'maxAge', 'stp'], bridgeNew);
      const hasChanged = isNotEqual(settingsNew, settingsOld);

      if (hasChanged) { changeSet.settings = settingsNew }
    }
    /**
     * Bridge ports change detection.
     */
    {
      const portsOld = view(bridgePortsLens, pristineCorrespondenceData);
      const portsNew = view(bridgePortsLens, dirtyCorrespondenceData);
      const hasChanged = isNotEqual(portsOld, portsNew);

      if (hasChanged) { changeSet.ports = portsNew }
    }

    if (isNotEmpty(changeSet)) { hwInterfaceInstructionsDescriptor.bridge = changeSet }
  }

  {
    const ospfOld = view(ospfLens, pristineCorrespondenceData);
    const ospfNew = defaultTo(ospfOld, view(ospfLens, dirtyCorrespondenceData));

    if (isNotEqual(ospfOld, ospfNew)) {
      hwInterfaceInstructionsDescriptor.ospf = ospfNew;
    }
  }

  return hwInterfaceInstructionsDescriptor;
};


module.exports = {
  update,
};
