'use strict';

const { Either } = require('monet');
const { curry, partial, partialRight, curryN } = require('lodash/fp');

/* eslint-disable max-len */
/**
 * Transformers layer
 * ------------------
 *
 * This transformation layer is build on patterns and principles of MDD (Model Driven Development).
 * The reason for this layer to exists is to hide the Model complexity from higher application layers.
 * For more information on what these patterns and principles are and how they work,
 * please refer to the following links:
 *
 * https://www.researchgate.net/publication/279748471_Model_transformation_design_patterns_for_bidirectionality
 * https://www.researchgate.net/publication/273398272_Model-Transformation_Design_Patterns
 * https://www.researchgate.net/publication/280641102_Design_Patterns_for_Model_Transformations_Current_research_and_future_directions
 *
 *
 * How it works ?
 *
 * Every Model in the application can be transformed into `correspondence` form. The `correspondence` form is
 * maximum standardized representation of the Model. `Correspondence` form is never exposed to the application
 * directly, but rather it is wrapped into safe functional monads, specifically Either monad.
 * Transformer of one Model usually consists of `mappers`, `mergers`, `parsers`.
 *
 * Parsers
 * -------
 *
 * This layer is responsible for parsing the Model and representing it in `correspondence` form.
 *
 * Mergers
 * -------
 *
 * This layer is responsible for merging `correspondence` form of the Model from various sources (database, hardware).
 *
 * Mappers
 * -------
 *
 * This layer is responsible for mapping `correspondence` form of Model to source Model (database, hardware, etc...)
 *
 *
 * Creating a new transformer
 * --------------------------
 *
 * Creating a new transformer usually means to create new module in `lib/transformers` directory. The name of the
 * module should correspond with the Model name. This new module should always contain following submodules:
 *  - mappers [required]
 *  - parsers [required]
 *  - mergers [optional]
 *
 * Links:
 * - https://cwmyers.github.io/monet.js/#either
 */
/* eslint-enable max-len */


// toCorrespondence :: (a -> b -> c) -> a -> b -> Either c
const toCorrespondence = curry(
  (parseStrategy, auxiliaries, rawData) => parseStrategy(auxiliaries, rawData)
);

// fromCorrespondence :: (a -> b) -> a -> b
const fromCorrespondence = curry((buildStrategy, correspondenceData) => buildStrategy(correspondenceData));

// merge :: (a -> b) -> Either b -> a -> Either c
const merge = curry((mergeStrategy, destinationCorrespondence, sourceCorrespondenceData) =>
  destinationCorrespondence.map(partial(mergeStrategy, [sourceCorrespondenceData]))
);

// mergeRight :: (a -> b) -> Either b -> a -> Either c
const mergeRight = curry((mergeStrategy, destinationCorrespondence, sourceCorrespondenceData) =>
  destinationCorrespondence.map(partialRight(mergeStrategy, [sourceCorrespondenceData]))
);

// diff :: (a -> b) -> Either b -> a -> Either.<Object>
const diff = curry((diffStrategy, correspondenceB, correspondenceDataA) =>
  correspondenceB.map(partial(diffStrategy, [correspondenceDataA]))
);

// diffRight :: (a -> b) -> Either b -> a -> Either.<Object>
const diffRight = curry((diffStrategy, correspondenceB, correspondenceDataA) =>
  correspondenceB.map(partialRight(diffStrategy, [correspondenceDataA]))
);

// liftEither ::  Number -> (a... -> a) -> (a... -> Either a)
const liftEither = curryN(2, (arity, func) => curryN(arity, (...args) => {
  try {
    return Either.Right(func(...args));
  } catch (e) {
    return Either.Left(e);
  }
}));

const liftParser = liftEither(2);
const liftMapper = liftEither(1);

// symbol for private metadata
const META_KEY = Symbol.for('correspondenceMeta');

module.exports = {
  META_KEY,
  toCorrespondence,
  fromCorrespondence,
  merge,
  mergeRight,
  diff,
  diffRight,
  liftEither,
  liftParser,
  liftMapper,
};
