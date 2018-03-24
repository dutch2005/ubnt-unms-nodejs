'use strict';

const { allPass, pick, ifElse, partition, path, pathSatisfies, pathEq, isEmpty, slice } = require('ramda');
const { pickBy, constant, flow, filter, unset } = require('lodash/fp');
const { isNotNull } = require('ramda-adjunct');

const { StaticRouteTypeEnum } = require('../../../../../enums');

function getCRUDRouteBlackholeQuery(correspondenceRoute) {
  return [
    'protocols',
    'static',
    'route',
    correspondenceRoute.destination,
    'blackhole',
  ];
}

function getCRUDRouteGatewayQuery(correspondenceRoute) {
  return [
    'protocols',
    'static',
    'route',
    correspondenceRoute.destination,
    'next-hop',
    correspondenceRoute.gateway,
  ];
}

function getCRUDRouteInterfaceQuery(correspondenceRoute) {
  return [
    'protocols',
    'static',
    'interface-route',
    correspondenceRoute.destination,
    'next-hop-interface',
    correspondenceRoute.interface,
  ];
}

function createCRUDRouteQuery(correspondenceRoute) {
  switch (correspondenceRoute.staticType) {
    case StaticRouteTypeEnum.Blackhole:
      return getCRUDRouteBlackholeQuery(correspondenceRoute);
    case StaticRouteTypeEnum.Interface:
      return getCRUDRouteInterfaceQuery(correspondenceRoute);
    case StaticRouteTypeEnum.Gateway:
      return getCRUDRouteGatewayQuery(correspondenceRoute);
    default:
      throw new Error(`Unimplemented static type "${correspondenceRoute.staticType}"`);
  }
}

function createDeleteRouteQuery(correspondenceRoute, correspondenceConfigRoutes) {
  if (correspondenceConfigRoutes.length === 1) {
    return [
      'protocols',
      'static',
    ];
  }
  const groupedConfigRoutes =
    partition(pathEq(['staticType'], StaticRouteTypeEnum.Interface), correspondenceConfigRoutes);

  const hasMultiple = flow(
    ifElse(
      pathEq(['staticType'], StaticRouteTypeEnum.Interface),
      flow(
        constant(groupedConfigRoutes),
        path([0]),
        filter(allPass([
          pathEq(['destination'], correspondenceRoute.destination),
        ])),
        pathSatisfies(len => len > 1, ['length'])
      ),
      flow(
        constant(groupedConfigRoutes),
        path([1]),
        filter(
          pathEq(['destination'], correspondenceRoute.destination)
        ),
        pathSatisfies(len => len > 1, ['length'])
      )
    )
  )([correspondenceRoute]);

  const query = createCRUDRouteQuery(correspondenceRoute);

  if (hasMultiple) {
    return query;
  } else if (correspondenceRoute.staticType === StaticRouteTypeEnum.Blackhole) {
    return query.slice(0, query.length - 1);
  }

  return query.slice(0, query.length - 2);
}

const createRouteMetaObj = ifElse(
  allPass([
    pathEq(['description'], null),
    pathEq(['distance'], null),
  ]),
  () => null,
  flow(pick(['description', 'distance']), pickBy(isNotNull))
);

const getMinimalObjectPath = (object, currentPath) => {
  const parentPath = slice(0, -1, currentPath);

  if (isEmpty(path(parentPath, object)) || isEmpty(parentPath)) {
    return getMinimalObjectPath(unset(currentPath, object), parentPath);
  }

  return currentPath;
};

module.exports = {
  createCRUDRouteQuery,
  createRouteMetaObj,
  createDeleteRouteQuery,
};
