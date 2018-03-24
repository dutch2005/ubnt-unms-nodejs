'use strict';

const { Observable, Subject, Scheduler: RxScheduler } = require('rxjs/Rx');
const prettyTime = require('pretty-hrtime');
const { isObject, isFunction, uniqueId } = require('lodash/fp');

const logging = require('../logging');
const { toMs } = require('../util');

/**
 * @typedef {Object} DailyTimeOption
 * @property {number} hour
 * @property {number} minute
 * @property {number} second
 */

/** @type {DailyTimeOption} */
const DEFAULT_DAILY_TIME = { hour: 4, minute: 0, second: 0 };
const DEFAULT_START_DELAY = toMs('seconds', 30);
const DAY = toMs('day', 1);

const toSubscribable = fn => () => {
  const result = fn();
  return (result instanceof Observable) || (isObject(result) && isFunction(result.then))
    ? result
    : Observable.of(result);
};

const millisecondsFromDayStart = dailyTime => (
  (dailyTime.hour * 60 * 60) +
  (dailyTime.minute * 60) +
  dailyTime.second) * 1000;

const start$ = Observable.of(null);

class Scheduler {
  /**
   * @private
   * @param {Function} worker
   * @return {Observable}
   */
  static process(worker) {
    return Observable.defer(worker)
      .ignoreElements()
      .catch((error) => {
        // actions should handle their errors, this is only for unhandled errors
        logging.log(['error', 'scheduler'], {
          message: `Unhandled error in worker '${worker.workerName}'`,
          error,
        });

        return Observable.empty();
      });
  }

  /**
   * @param {DailyTimeOption} dailyTime
   * @param {number} startDelay
   * @param {Rx.Scheduler} rxScheduler
   */
  constructor(dailyTime = DEFAULT_DAILY_TIME, startDelay = DEFAULT_START_DELAY, rxScheduler = RxScheduler.async) {
    this.rxScheduler = rxScheduler;
    this.dailyTime$ = Observable.defer(this.scheduleDailyTime.bind(this, millisecondsFromDayStart(dailyTime)));
    this.startDelay$ = Observable.timer(startDelay, this.rxScheduler);
    this.nextWorkerName = uniqueId.bind(null, 'anonymous-worker-');
    this.timers = new Map();

    this.queue = new Subject();
    this.subscription = this.queue
      .mergeAll()
      .subscribe();
  }

  /**
   * @private
   * @param {number} fromDayStart
   * @return {Observable.<*>}
   */
  scheduleDailyTime(fromDayStart) {
    const now = this.rxScheduler.now();
    const dayStart = Math.floor(now / DAY) * DAY;
    const time = dayStart + fromDayStart;
    return Observable.timer(Math.abs(now - (time <= now ? time + DAY : time)), this.rxScheduler);
  }

  /**
   * @param {Function} worker
   * @param {Rx.Notification} message
   * @return {void}
   */
  measureTaskExecutionTime(worker, message) {
    const name = worker.workerName;
    if (message.kind === 'N') {
      logging.log(['info', 'scheduler'], `Started task ${name}`);
      this.timers.set(worker, process.hrtime());
    } else {
      const timer = this.timers.get(worker);
      logging.log(['info', 'scheduler'], `Finished task ${name} (${prettyTime(process.hrtime(timer))})`);
    }
  }

  /**
   * @param {Function} worker
   * @param {number} interval
   * @param {string} name
   * @return {void}
   */
  registerPeriodicTask(worker, interval = -1, name = this.nextWorkerName()) {
    const dailyInterval = interval <= 0;
    const initialDelay$ = dailyInterval ? this.dailyTime$ : this.startDelay$;
    const delay = dailyInterval ? DAY : interval;
    const subscribableWorker = toSubscribable(worker);
    subscribableWorker.workerName = name;

    const $task = Observable.concat(start$, Scheduler.process(subscribableWorker))
      .materialize()
      .do(this.measureTaskExecutionTime.bind(this, subscribableWorker))
      .repeatWhen(notifications => notifications.delay(delay, this.rxScheduler));

    this.queue.next(initialDelay$.mergeMapTo($task));
  }

  /**
   * @param {Function} worker
   * @param {string} name
   * @return {void}
   */
  registerDailyTask(worker, name) {
    this.registerPeriodicTask(worker, -1, name);
  }

  /**
   * Stop task execution
   *
   * @return {void}
   */
  destroy() {
    this.subscription.unsubscribe();
    logging.log(['info', 'scheduler'], 'Scheduler destroyed');
  }
}

module.exports = Scheduler;
