'use strict';

const { isUndefined } = require('ramda-adjunct');
const { forEach } = require('ramda');
const FutureTEither = require('monad-t/lib/FlutureTMonetEither');

const { fromDbList: fromDbDataLinkList } = require('../transformers/data-link');

/**
 * @file Datalink objects in memory
 *
 * Representation of the links are stored as adjacency list and converted to the graph (edges and its vertices)
 */

/**
 * @typedef {Object} DbDataLink
 * @property {UUID} id
 * @property {UUID} deviceIdFrom
 * @property {string} interfaceNameFrom
 * @property {UUID} deviceIdTo
 * @property {string} interfaceNameTo
 * @property {string} origin
 */

/**
 * @typedef {Object} Edge
 * @property {UUID} deviceId
 * @property {string} interfaceName
 */

class DataLinkStore {
  constructor(dal) {
    this.dataLinks = [];
    this.dataLinksGraph = [];
    this.repository = dal.dataLinkRepository;
  }

  /**
   * @return {Promise.<void>}
   */
  initialize() {
    return FutureTEither
      .tryP(this.repository.findAll)
      .chainEither(fromDbDataLinkList({}))
      .tap((dataLinks) => { this.dataLinks = dataLinks })
      .tap(forEach((dataLink) => {
        const from = { deviceId: dataLink.deviceIdFrom, interfaceName: dataLink.interfaceNameFrom };
        const to = { deviceId: dataLink.deviceIdTo, interfaceName: dataLink.interfaceNameTo };
        this.addEdgeVertices(from, [to]);
        this.addEdgeVertices(to, [from]);
      }))
      .promise();
  }

  /**
   * Adds edge and its vertices to the instance prop dataLinksGraph
   * @param {Edge} edge as device and interface pair
   * @param {Array.<Edge>} vertices array of edges linked to the first param edge
   * @return {void}
   */
  addEdgeVertices(edge, vertices) {
    const dataLinkDevice = this.dataLinksGraph[edge.deviceId];
    if (isUndefined(dataLinkDevice)) {
      this.dataLinksGraph[edge.deviceId] = [];
    }

    if (isUndefined(this.dataLinksGraph[edge.interfaceName])) {
      this.dataLinksGraph[edge.deviceId][edge.interfaceName] = vertices;
    } else {
      this.dataLinksGraph[edge.deviceId][edge.interfaceName] = dataLinkDevice[edge.interfaceName].concat(vertices);
    }
  }

}


module.exports = { DataLinkStore };
