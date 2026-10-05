'use strict';
const { createStaticResponder } = require('./static-responder.js');

function createProtocolHandler(rootDir, extraRoots = {}) {
  const roots = { '': rootDir, ...extraRoots };
  const responders = new Map();
  const getResponder = (host) => {
    const dir = roots[host];
    if (!dir) return null;
    if (!responders.has(host)) {
      responders.set(host, createStaticResponder(dir));
    }
    return responders.get(host);
  };
  return async (request) => {
    const url = new URL(request.url);
    const respond = getResponder(url.hostname);
    if (!respond) return new Response('Not Found', { status: 404 });
    return respond(url.pathname, request.headers.get('Range'));
  };
}

module.exports = { createProtocolHandler };
