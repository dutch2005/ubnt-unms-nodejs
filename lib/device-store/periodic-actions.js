'use strict';

const { Subject, Observable } = require('rxjs/Rx');
const serializeError = require('serialize-error');
const { identity, isUndefined, defaultTo } = require('lodash/fp');
const FibonacciHeap = require('@tyriar/fibonacci-heap');

const MAXIMUM_CONCURRENCY = 100;
const ONE_SECOND = 1000;

class PeriodicActions {
  constructor(deviceSettings, logger) {
    this.logger = logger;
    this.deviceSettings = deviceSettings;

    this.actionCounter = 0;
    this.timeoutId = null;
    this.nextAction = null;

    this.actions = new Map(); // indexed by actionId
    this.actionsLists = new Map(); // indexed by deviceId
    this.heap = new FibonacciHeap();
    this.queue = new Subject();

    const processor = this.process.bind(this);
    const reschedule = this.reschedule.bind(this);

    this.subscription = this.queue
      .mergeMap(processor, identity, MAXIMUM_CONCURRENCY)
      .do(reschedule)
      .subscribe();
  }

  schedule(deviceId, action, intervalName) {
    const actionId = this.nextActionId();

    this.logger.log(['info', 'periodic-actions'], `Scheduling action ${intervalName} for ${deviceId}`);
    let actionList = this.actionsLists.get(deviceId);
    if (isUndefined(actionList)) {
      actionList = [];
      this.actionsLists.set(deviceId, actionList);
    }

    actionList.push(actionId);

    this.actions.set(actionId, { deviceId, action, intervalName });

    this.queue.next(actionId);
  }

  stop(deviceId) {
    const actionList = this.actionsLists.get(deviceId);
    if (isUndefined(actionList)) { return }

    this.logger.log(['info', 'periodic-actions'], `Device ${deviceId} actions stopped`);

    // eslint-disable-next-line no-restricted-syntax
    for (const actionId of actionList) {
      this.actions.delete(actionId);
    }
    this.actionsLists.delete(deviceId);
  }

  destroy() {
    this.subscription.unsubscribe();
    this.heap.clear();
    this.logger.log(['info', 'periodic-actions'], 'Queue destroyed');
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }
  }

  /**
   * @private
   * @param {number} actionId
   * @return {void}
   */
  reschedule(actionId) {
    const now = Date.now();
    const periodicAction = this.getAction(actionId);

    // action already canceled or not in store
    if (periodicAction === null) {
      if (this.nextAction === null) {
        this.scheduleNextAction(now);
      }
      return;
    }

    const { deviceId, intervalName } = periodicAction;

    const nextOccurrence = now + this.deviceSettings.getInterval(deviceId, intervalName);
    this.heap.insert(nextOccurrence, actionId);
    this.scheduleNextAction(now);
  }

  scheduleNextAction(now) {
    const firstAction = this.heap.findMinimum();

    if (isUndefined(firstAction)) {
      return;
    }

    const nextAction = this.nextAction;
    if (firstAction !== nextAction && (nextAction === null || (nextAction.key - now) > ONE_SECOND)) {
      this.nextAction = firstAction;
      if (this.timeoutId !== null) { clearTimeout(this.timeoutId) }
      const nextTime = firstAction.key - now;
      this.timeoutId = setTimeout(() => this.pushToQueue(), Math.max(nextTime, 0));
    }
  }

  /**
   * @private
   * @return {void}
   */
  pushToQueue() {
    const now = Date.now();
    this.nextAction = null;

    while (!this.heap.isEmpty()) {
      const nextAction = this.heap.findMinimum();
      if (nextAction.key - now < ONE_SECOND) {
        this.heap.extractMinimum();
        this.queue.next(nextAction.value);
      } else {
        break;
      }
    }
  }

  /**
   * @private
   * @param {number} actionId
   * @return {Observable}
   */
  process(actionId) {
    const periodicAction = this.getAction(actionId);

    // action already canceled or not in store
    // propagate actionId to upstream to reschedule next events
    if (periodicAction === null) {
      return Observable.of(actionId);
    }

    const { action } = periodicAction;
    return Observable.defer(action)
      .last(null, null, actionId) // take only last element or return actionId
      .catch((error) => {
        const { deviceId, intervalName } = periodicAction;

        // actions should handle their errors, this is only for unhandled errors
        this.logger.log(['error', 'periodic-actions'], {
          message: `Unhandled error in action ${intervalName} on device ${deviceId}`,
          error: serializeError(error),
        });

        return Observable.of(actionId);
      });
  }

  /**
   * @private
   * @return {number}
   */
  nextActionId() {
    const actionId = this.actionCounter;
    this.actionCounter += 1;

    return actionId;
  }

  /**
   * @private
   * @param {number} actionId
   * @return {Object}
   */
  getAction(actionId) {
    return defaultTo(null, this.actions.get(actionId));
  }
}

module.exports = PeriodicActions;
