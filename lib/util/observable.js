'use strict';

const { Observable } = require('rxjs/Rx');

function fromEither(either) {
  return either.cata(Observable.throw, Observable.of);
}

function mergeEither(fn) {
  return this.mergeMap(value => fromEither(fn(value)));
}

function tapO(factory) {
  return this.mergeMap(value => Observable
    .defer(() => factory(value))
    .ignoreElements()
    .concat(Observable.of(value))
  );
}

Observable.fromEither = fromEither;
Observable.prototype.tapO = tapO;
Observable.prototype.mergeEither = mergeEither;
