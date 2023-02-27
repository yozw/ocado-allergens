var cache = {};

function extractInitialStateFromPageContent(text) {
  const PREFIX = 'window.INITIAL_STATE =';

  for (let line of text.split('\n')) {
    line = line.trim();
    if (!line.startsWith(PREFIX)) {
      continue;
    }
    let data = JSON.parse(line.slice(PREFIX.length, -1));
    return data;
  }
  return {};
}

function getIngredientsFromInitialState(state) {
  if ((state === null) || (state.constructor !== Object)) {
    return null;
  }
  if (state.ingredients) {
    return state.ingredients;
  }
  for (const [key, value] of Object.entries(state)) {
    const returnValue = getIngredientsFromInitialState(value);
    if (returnValue !== null) {
      return returnValue;
    }
  }
  return null;
}

function crawlContent(url) {
  return fetch(url).then(response => response.text())
    .then(extractInitialStateFromPageContent)
    .then(getIngredientsFromInitialState)
    .then(response => (response !== null) ? response : {});
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.sender === "ocado-allergens") {
      if (cache[request.url] !== undefined) {
        sendResponse(cache[request.url]);
        return false;
      } else {
        function saveToCache(response) {
          cache[request.url] = response;
          return response;
        }
        crawlContent(request.url).then(saveToCache).then(sendResponse);
        return true;
      }
    }
  }
);