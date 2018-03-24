'use strict';

// HAPI plugin registration helper
// adds error handling, automatically calls next(), supports promises
// usage: exports.register = registerPlugin((server, options) => { ... }[, (server, options) => { ... }, ...])
const registerPlugin = handler =>
  function wrapper(server, options, next) {
    // používáme console.log namísto logging pluginu
    // protože ten ještě nemusí existovat a i kdyby ano
    // nemůže použít server.log, protože server ještě neběží
    console.log(`Registering plugin '${this.name}'...`);
    return Promise.resolve()
      .then(handler.bind(this, server, options))
      .then(() => console.log(`Plugin '${this.name}' registration done.`))
      .then(() => next())
      .catch(next);
  };

module.exports = {
  registerPlugin,
};
