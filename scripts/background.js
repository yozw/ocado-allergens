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

function fetchFromStorage(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    }
    catch (err) {
      reject(err);
    }
  });
}

function saveToStorage(key, value) {
  return new Promise((resolve, reject) => {
    try {
      const data = {};
      data[key] = value;
      chrome.storage.local.set(data, resolve);
    }
    catch (err) {
      reject(err);
    }
  });
}

async function crawlContent(url) {
  const key = 'ingredients::' + url;
  const result = await fetchFromStorage(key);
  if (result !== undefined) {
    return result
  }
  const response = await fetch(url);
  const text = await response.text();
  const initialState = extractInitialStateFromPageContent(text);
  let ingredients = getIngredientsFromInitialState(initialState, {});
  if (ingredients === null) {
    ingredients = {};
  }
  saveToStorage(key, ingredients);
  return ingredients;
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