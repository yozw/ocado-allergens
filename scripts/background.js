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

function cleanUrl(url) {
  const urlObj = new URL(url);
  urlObj.search = '';
  urlObj.hash = '';
  return urlObj.toString();
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.sender === "ocado-allergens") {
      url = cleanUrl(request.url);
      if (cache[url] !== undefined) {
        sendResponse(cache[url]);
        return false;
      } else {
        function saveToCache(response) {
          cache[url] = response;
          return response;
        }
        crawlContent(url).then(saveToCache).then(sendResponse);
        return true;
      }
    }
  }
);