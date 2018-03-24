'use strict';

const { Observable, Subject, AsyncSubject } = require('rxjs/Rx');
const { isFunction, isObject, uniqueId } = require('lodash/fp');
const serializeError = require('serialize-error');

const { RpcError, RpcTimeoutError, ConnectionClosedError } = require('./errors');
const { getClientIpFromRequest } = require('../util');

const DEFAULT_RPC_TIMEOUT = 15000;

const ignoreError = () => Observable.empty();

const throwError = error => Observable.throw(error);

const timeoutError = (messageId, messageName) =>
  Observable.defer(() => throwError(new RpcTimeoutError(messageId, messageName)));

const isSubscribable = value => value instanceof Observable || (isObject(value) && isFunction(value.then));

const applyMiddleware = (middlewares, initialObject, context) => Observable.of(initialObject)
  .expand((partiallyProcessed, index) => {
    if (index < middlewares.length) {
      try {
        const result = middlewares[index](partiallyProcessed, context);
        return isSubscribable(result) ? Observable.from(result).last() : Observable.of(result);
      } catch (e) {
        return Observable.throw(e);
      }
    } else if (index === 0) {
      return Observable.of(partiallyProcessed);
    }

    return Observable.empty();
  })
  .takeLast(1);

const notifyMiddleware = (middlewares, ...args) => Observable.of(0)
   // don't use concatMap, because middlewares array may change
  .expand((_, index) => {
    if (index >= middlewares.length) {
      return Observable.empty();
    }

    const result = middlewares[index](...args);
    if (isSubscribable(result)) { return result }
    return Observable.of(result);
  })
  .ignoreElements(); // ignore everything, middleware is only notified

/**
 * Special event handler, because ws is not an EventEmitter
 * @param {WebSocket} ws
 * @param {string} eventName
 * @return {Observable.<*>}
 */
const fromWebSocketEvent = (ws, eventName) => Observable.fromEventPattern(
  (handler) => { ws.on(eventName, handler) },
  (handler) => { ws.removeListener(eventName, handler) }
);

const handleRpcError = message => (message.error !== null
    ? Observable.throw(new RpcError(message))
    : Observable.of(message)
);

const nextConnectionId = uniqueId.bind(null, 'connection-');

class WebSocketConnection {
  get isClosed() {
    return this.ws.readyState === this.ws.CLOSED;
  }

  /**
   * @param {WebSocket} ws
   * @param {IncomingMessage} request
   * @param {string} protocol
   * @param {Logging} logging
   */
  constructor(ws, request, protocol, logging) {
    this.connectionId = nextConnectionId();
    this.ws = ws;
    this.remoteAddress = getClientIpFromRequest(request, true);
    this.protocol = protocol;
    this.logging = logging;

    this.log(`Receiving connection from ${this.remoteAddress} via protocol ${this.protocol}`);

    this.incomingMiddleware = [];
    this.outgoingMiddleware = [];

    this.establishMiddleware = [];
    this.closeMiddleware = [];

    this.errorMiddleware = [];

    this.sendToSocket = Observable.bindNodeCallback(ws.send.bind(ws));
    this.self$ = Observable.of(this);

    // shared web socket event streams because only one listener is supported
    this.close$ = fromWebSocketEvent(ws, 'close')
      .take(1) // take first event and unsubscribe
      .mergeMap(this.handleClose.bind(this))
      .publishLast(); // only publish last value so after connection close late
                      // subscribers also receive the close event
    this.messages$ = fromWebSocketEvent(ws, 'message')
      .concatMap(this.handleIncoming.bind(this)) // handle messages one by one, because middlewares are not stateless
      .publish();
    this.error$ = fromWebSocketEvent(ws, 'error')
      .mergeMap(Observable.throw)
      .merge(this.messages$.ignoreElements()) // propagate errors from messages stream
      .catch(error => this.handleError(error))
      .publish();
    this.commandQueue = new Subject();
    this.commands$ = this.commandQueue
      .concatAll() // serialize all commands
      .share();

    // merge subscriptions
    const subscription = this.messages$.connect();
    subscription.add(this.error$.connect());

    this.subscription = subscription;

    // intentionally not merged with other subscriptions, if shared of refCounted close handlers might not be called
    // will not leak subscription or listener - see take(1) above
    this.close$.connect();
  }

  use(middleware) {
    if (isFunction(middleware.handleIncoming)) {
      this.incomingMiddleware.push(middleware.handleIncoming.bind(middleware));
    }

    if (isFunction(middleware.handleOutgoing)) {
      this.outgoingMiddleware.unshift(middleware.handleOutgoing.bind(middleware));
    }

    if (isFunction(middleware.handleEstablish)) {
      this.establishMiddleware.push(middleware.handleEstablish.bind(middleware));
    }

    if (isFunction(middleware.handleClose)) { this.closeMiddleware.unshift(middleware.handleClose.bind(middleware)) }

    if (isFunction(middleware.handleError)) { this.errorMiddleware.unshift(middleware.handleError.bind(middleware)) }

    return this;
  }

  handleIncoming(message) {
    return applyMiddleware(this.incomingMiddleware, message, this);
  }

  handleOutgoing(message) {
    return applyMiddleware(this.outgoingMiddleware, message, this);
  }

  handleEstablish() {
    return notifyMiddleware(this.establishMiddleware, this);
  }

  handleClose() {
    this.log(`Closing connection from ${this.remoteAddress} via protocol ${this.protocol}`);
    return notifyMiddleware(this.closeMiddleware, this)
      .concat(this.self$)
      .finally(this.destroy.bind(this));
  }

  handleError(error, suppress = false) {
    return applyMiddleware(this.errorMiddleware, error, this)
      .mergeMap(suppress ? ignoreError : throwError);
  }

  send(message) {
    if (this.isClosed) {
      return Observable.throw(new ConnectionClosedError(message.name));
    }

    this.log(`Sending: ${message.name}`);
    return this.handleOutgoing(message)
      .mergeMap(this.sendToSocket) // doesn't need bind
      .mapTo(this) // return connection for chaining
      .takeUntil(this.close$);
  }

  rpc(message, timeout = DEFAULT_RPC_TIMEOUT) {
    return this.send(message)
      .switchMapTo(this.messages$)
      .filter(response => response.id === message.id)
      .mergeMap(handleRpcError)
      .timeoutWith(timeout, timeoutError(message.id, message.name))
      .take(1);
  }

  cmd(message, timeout = DEFAULT_RPC_TIMEOUT) {
    if (this.isClosed) {
      return Observable.throw(new ConnectionClosedError(message.name));
    }

    return Observable.create((observer) => {
      const canceled$ = new AsyncSubject();

      const cmd$ = this.rpc(message, timeout)
        .takeUntil(canceled$)
        .do(observer)
        .catch(ignoreError); // error is handled by observer

      // subscribe to commands to start or continue processing
      const subscription = this.commands$.subscribe();

      // stop command processing on unsubscribe
      subscription.add(() => {
        canceled$.next();
        canceled$.complete();
      });

      this.commandQueue.next(cmd$);

      return subscription;
    });
  }

  /**
   * Log any message with connection tags
   *
   * @param {string|Object} message
   * @return {void}
   */
  log(message) {
    this.logging.log(['info', 'ws', this.connectionId], message);
  }

  /**
   * Log non serious error / warning with connection tags
   *
   * @param {Error} error
   * @return {void}
   */
  logWarning(error) {
    this.logging.log(['info', 'ws-warn', 'ws', this.connectionId], error.message);
  }

  /**
   * Log serious error with connection tags
   *
   * @param {Error} error
   * @return {void}
   */
  logError(error) {
    this.logging.log(['info', 'ws-error', 'ws', this.connectionId], {
      message: error.message,
      error: serializeError(error),
    });
  }

  establish() {
    this.log('Establishing connection');
    return this.handleEstablish()
      .catch(error => this.handleError(error))
      .concat(this.self$);
  }

  /**
   * @param {?Error} [error]
   * @return {Observable.<*>}
   */
  close(error = null) {
    if (!this.isClosed) {
      this.log(`Forcing connection close from ${this.remoteAddress}`);
      this.ws.close();
    }

    return this.close$
      .mergeMapTo(error !== null ? this.handleError(error) : this.self$);
  }

  destroy() {
    this.subscription.unsubscribe();
  }

  // used by observables
  unsubscribe() {
    this.log('Connection destroyed');
    if (!this.isClosed) {
      this.ws.close();
    }
  }
}

module.exports = WebSocketConnection;
