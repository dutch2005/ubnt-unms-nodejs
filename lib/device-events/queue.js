'use strict';

const { Observable } = require('rxjs/Rx');
const serializeError = require('serialize-error');
const { isUndefined, has, isNull, flow, getOr, isObject, isFunction } = require('lodash/fp');

const toSubscribable = value => ((value instanceof Observable || (isObject(value) && isFunction(value.then)))
  ? value
  : Observable.of(value));

class DeviceEventQueue {
  constructor(logging) {
    this.logging = logging;

    this.deviceQueues = new Map();
    this.processing = new Set();

    this.handlers = {};
  }

  add(event) {
    const deviceId = event.deviceId;

    const queue = this.deviceQueues.get(deviceId);

    if (isUndefined(queue)) {
      // setup new queue
      this.deviceQueues.set(deviceId, { events: { [event.type]: event }, order: [event.type] });
    } else {
      // check if event type is already in the queue
      if (!has(event.type, queue.events)) {
        queue.order.push(event.type);
      }

      // update or set event to the queue
      queue.events[event.type] = event;
    }

    if (!this.processing.has(deviceId)) {
      this.process(deviceId);
    }
  }

  registerHandler(name, handler) {
    if (!this.handlers[name]) {
      this.handlers[name] = flow(handler, toSubscribable);
    }
  }

  registerHandlers(handlers) {
    Object.entries(handlers).forEach(([name, handler]) => this.registerHandler(name, handler));
  }

  findHandler(event) {
    const handler = this.handlers[event.type];
    if (isUndefined(handler)) {
      this.logging.log(['qe'], `Qe - unsupported event type: ${event.type}`);
      return null;
    }

    return handler;
  }

  nextEvent(deviceId) {
    const queue = this.deviceQueues.get(deviceId);

    if (isUndefined(queue)) {
      return null;
    }

    const eventType = queue.order.shift();
    const event = getOr(null, eventType, queue.events);
    delete queue.events[eventType];

    return event;
  }

  process(deviceId) {
    const event = this.nextEvent(deviceId);

    // no more events in the queue, stop processing
    if (isNull(event)) {
      this.deviceQueues.delete(deviceId);
      return;
    }

    const handler = this.findHandler(event);

    if (handler === null) {
      this.finalizeProcessing(deviceId, event);
      return;
    }

    this.processing.add(deviceId);
    Observable.defer(handler.bind(null, event))
      .subscribe({
        error: (error) => { this.finalizeProcessing(deviceId, event, error) },
        complete: () => { this.finalizeProcessing(deviceId, event) },
      });
  }

  finalizeProcessing(deviceId, event, error = null) {
    if (error !== null) {
      this.logging.log(['error', 'qe'], {
        message: `Qe - device: ${event.deviceId} event: ${event.type}`,
        error: serializeError(error),
      });
    } else {
      this.logging.log(['qe'], `Qe - device: ${event.deviceId} event: ${event.type} status: ok`);
    }

    this.processing.delete(deviceId);
    this.process(deviceId);

    return true;
  }
}

module.exports = DeviceEventQueue;
