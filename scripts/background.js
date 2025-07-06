/*
TODO:

* Move debug logging into a separate function.
* Read product titles.
* Products have Allergen Information and Dietary Information. Read that content too.

*/

const cache = {};
const DEBUG = true;
const ENABLE_STORAGE = false;

function extractInitialStateFromPageContent(text, url) {
  const regex = /<script data-test="initial-state-script"[^>]*>window\.__INITIAL_STATE__\s*=\s*({.*?})<\/script>/s;

  for (let line of text.split('\n')) {
    const match = line.match(regex);
    if (!match || !match[1]) {
      continue;
    }
    const jsonString = match[1];
    let data = JSON.parse(jsonString);
    if (DEBUG) {
      console.log("Fetched initial state from", url, ":", data);
    }
    return data;
  }
  if (DEBUG) {
    console.log('No initial state found in', url);
  }
  return {};
}

function findIngredientsContent(obj) {
  if (obj === null || typeof obj !== 'object') {
    return undefined;
  }
  if (obj.hasOwnProperty('title') && obj.title === 'ingredients' && obj.hasOwnProperty('content')) {
    return obj.content;
  }


  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = findIngredientsContent(obj[i]);
      if (result !== undefined) {
        return result;
      }
    }
  }
  else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const result = findIngredientsContent(obj[key]);
        if (result !== undefined) {
          return result;
        }
      }
    }
  }

  return undefined;
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
  if (value !== null && typeof(value) !== "string") {
    throw new Error("Expected value to be a string or null.");
  }
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
  if (ENABLE_STORAGE) {
    const result = await fetchFromStorage(key);
    if (result !== undefined) {
        if (DEBUG) {
          console.log('Fetched ingredients for', url, 'from storage');
        } 
      return result
    }
  }
  if (DEBUG) {
    console.log('Fetching', url);
  }
  const response = await fetch(url);
  const text = await response.text();
  const initialState = extractInitialStateFromPageContent(text, url);
  let ingredients = findIngredientsContent(initialState);
  if (!ingredients) {
    if (DEBUG) {
      console.log("No ingredient information for", url);
    }
    ingredients = null;
  } else {
    console.log("Found ingredient information for", url, ":", ingredients);
  }
  saveToStorage(key, ingredients);
  return ingredients;
}


function cleanUrl(url) {
  const urlObj = new URL(url);
  urlObj.search = '';
  urlObj.hash = '';
  url = urlObj.toString();
  if (url.startsWith('https://ww2.ocado.com/webshop/product/')) {
    const tokens = url.split('/');
    const productId = tokens[tokens.length - 2].toLowerCase() + '-' + tokens[tokens.length - 1];
    url = 'https://ww2.ocado.com/products/' + productId;
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