'use strict';

const { has, noop, defaults } = require('lodash/fp');

const { error: logError } = require('../logging');

/**
 * @callback TaskQueue~workerCallback
 * @param {string} taskId
 * @param {*} payload
 * @return {Observable}
 */

/**
 * @callback TaskQueue~discriminatorCallback
 * @param {DbTask} task
 * @return {boolean}
 */

/**
 * @callback TaskQueue~cancelerCallback
 * @param {DbTask} task
 * @return {Promise.<void>}
 */

/**
 * @callback TaskQueue~onEnqueueCallback
 * @param {DbTask} task
 * @return {Promise.<void>}
 */

const optionDefaults = defaults({ concurrency: 1, paused: false });

class TaskQueue {
  /**
   * @param {TaskQueue~workerCallback} worker
   * @param {TaskQueue~discriminatorCallback} discriminator
   * @param {TaskQueue~cancelerCallback} [canceler]
   * @param {TaskQueue~onEnqueueCallback} [onEnqueue]
   * @param {Object} [options]
   */
  constructor(worker, discriminator, canceler = noop, onEnqueue = noop, options = {}) {
    const { concurrency, paused } = optionDefaults(options);
    this.queue = [];
    this.concurrency = concurrency;
    this.ongoing = 0;
    this.paused = paused ? 1 : 0;

    this.tasks = {};
    this.processing = {};
    this.worker = worker;
    this.discriminator = discriminator;
    this.canceler = canceler;
    this.onEnqueue = onEnqueue;
  }

  /**
   * @param {DbTask} task
   * @return {boolean}
   */
  canProcess(task) {
    return this.discriminator.call(null, task);
  }

  get isPaused() {
    return this.paused !== 0;
  }

  /**
   * @return {void}
   */
  pause() {
    this.paused += 1;
  }

  /**
   * @return {void}
   */
  resume() {
    this.paused -= 1;

    if (!this.isPaused && this.ongoing < this.concurrency) {
      this.process();
    }
  }

  /**
   * @param {string} taskId
   * @param {*} payload
   * @return {void}
   */
  enqueue(taskId, payload) {
    this.tasks[taskId] = payload;
    this.queue.push(taskId);
    this.onEnqueue.call(null, taskId, payload);

    if (!this.isPaused && this.ongoing < this.concurrency) {
      this.process();
    }
  }

  /**
   * @return {void}
   */
  process() {
    if (this.ongoing >= this.concurrency) {
      throw new Error('TaskQueue: Too many jobs in progress');
    }

    let taskId = this.queue.shift();
    while (!has(taskId, this.tasks) && this.queue.length > 0) { taskId = this.queue.shift() }

    if (!has(taskId, this.tasks)) { return }

    const payload = this.tasks[taskId];
    delete this.tasks[taskId];

    this.ongoing += 1;
    try {
      this.processing[taskId] = this.worker.call(null, taskId, payload)
        .finally(() => { // process another job when observable completes
          this.finalize(taskId);
        })
        .subscribe({
          error(err) {
            logError('TaskQueue: Job processing failed', err);
          },
        });
    } catch (err) {
      logError('TaskQueue: Worker failed', err);
      this.finalize(taskId);
      this.cancel(taskId, payload);
    }
  }

  finalize(taskId) {
    delete this.processing[taskId];
    this.ongoing -= 1;
    if (!this.isPaused && this.ongoing < this.concurrency) {
      this.process();
    }
  }

  /**
   * @param {string} taskId
   * @param {*} payload
   * @return {void}
   */
  cancel(taskId, payload) {
    if (has(taskId, this.processing)) {
      this.processing[taskId].unsubscribe(); // cleanup is handled in subscription
    } else if (has(taskId, this.tasks)) {
      delete this.tasks[taskId]; // queue is handled automatically
    }

    this.canceler.call(null, taskId, payload);
  }
}

module.exports = { TaskQueue };
