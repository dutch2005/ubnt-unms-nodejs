'use strict';

const { Form } = require('multiparty');
const { isString } = require('lodash/fp');
const { Observable } = require('rxjs/Rx');

const { FirmwareOriginEnum } = require('../../../enums');
const validation = require('../../../validation');

/*
 * Route definitions
 */

function registerRoutes(server, options, service) {
  server.route({
    method: 'GET',
    path: '/v2.1/firmwares',
    handler(request, reply) {
      reply(
        service.getFirmwares()
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/firmwares',
    config: {
      auth: {
        scope: 'admin',
      },
      payload: {
        output: 'stream',
        maxBytes: 500e6,
        parse: false,
        allow: 'multipart/form-data',
      },
    },
    handler(request, reply) {
      const rawRequest = request.raw.req;
      const form = new Form();

      const error$ = Observable.fromEvent(form, 'error').mergeMap(Observable.throw);
      const close$ = Observable.fromEvent(form, 'close');
      Observable.fromEvent(form, 'part')
        .merge(error$)
        .takeUntil(close$)
        .mergeMap((part) => {
          if (!isString(part.filename)) {
            part.resume();
            return Observable.empty();
          }

          return service.uploadFirmwareImage(FirmwareOriginEnum.Manual, part);
        })
        .take(1)
        .subscribe(reply, reply);

      form.parse(rawRequest);
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/firmwares/delete',
    config: {
      auth: {
        scope: 'admin',
      },
      validate: {
        payload: validation.firmwareDeleteList,
      },
    },
    handler(request, reply) {
      reply(
        service.removeFirmwares(request.payload)
      );
    },
  });

  server.route({
    method: 'POST',
    path: '/v2.1/firmwares/ubnt',
    handler(request, reply) {
      reply(
        service.getUbntFirmwares()
      );
    },
  });
}

module.exports = {
  registerRoutes,
};
