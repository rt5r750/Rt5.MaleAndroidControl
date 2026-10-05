'use strict';

function buildTtsCallbackJs(callbackId, resultJson) {
  return `if(window.__ttsOnComplete)window.__ttsOnComplete(${JSON.stringify(String(callbackId))}, ${JSON.stringify(String(resultJson))})`;
}

function buildFetchCallbackJs(callbackId) {
  return `if(window.__mimoFetchCallback)window.__mimoFetchCallback(${JSON.stringify(String(callbackId))})`;
}

module.exports = { buildTtsCallbackJs, buildFetchCallbackJs };
