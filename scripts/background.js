const cache = {};

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
  // TODO: Retrieve from storage
  console.log('Retrieving ' + url);
  return fetch(url).then(response => response.text())
    .then(extractInitialStateFromPageContent)
    .then(getIngredientsFromInitialState)
    .then(response => (response !== null) ? response : {});
}

function cleanUrl(url) {
  const urlObj = new URL(url);
  urlObj.search = '';
  urlObj.hash = '';
  url = urlObj.toString();
  if (url.startsWith('https://www.ocado.com/webshop/product/')) {
    const tokens = url.split('/');
    const productId = tokens[tokens.length - 2].toLowerCase() + '-' + tokens[tokens.length - 1];
    url = 'https://www.ocado.com/products/' + productId;
  }
  return url;
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.sender === "ocado-allergens") {
      const url = cleanUrl(request.url);
      if (cache[url] === undefined) {
        cache[url] = crawlContent(url);
      } 
      cache[url].then(sendResponse);
      return true;
    }
  }
);