const cache = {};
const DEBUG = false;
const ENABLE_STORAGE = true;

function log_debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * Extracts data from an Ocado page.
 * 
 * The data is conveniently stored in a JSON dictionary inside a <script> tag.
 *
 * Returns a nested structure of primitives, arrays, and dictionaries.
 **/
function extractPageData(text, url) {
  const regex = /<script data-test="initial-state-script"[^>]*>window\.__INITIAL_STATE__\s*=\s*({.*?})<\/script>/s;

  for (const line of text.split('\n')) {
    const match = line.match(regex);
    if (!match || !match[1]) {
      continue;
    }
    const jsonString = match[1];
    const pageData = JSON.parse(jsonString);
    log_debug("Fetched page data (initial state) from", url, ":", pageData);
    return pageData;
  }
  log_debug('No page data (initial state) found in', url);
  return {};
}

/**
 * Extracts product data from pageData that may contain ingredient information about the product.
 * 
 * Take the pageData, and a dictionary to which to append product data. 
 * The dictionary should have two entries:
 * - 'ingredients': a list of ingredients information (strings);
 * - 'info': a list of additional information (strings).
 **/
function extractProductData(pageData, output) {
  if (pageData === null || typeof pageData !== 'object') {
    return undefined;
  }

  if (pageData.hasOwnProperty('content') && pageData.hasOwnProperty('title')) {
    if (pageData.title === 'ingredients' || pageData.title === 'allergens') {
      output.ingredients.push(pageData.content);
    } else if (pageData.title === 'otherInformation' || pageData.title === 'dietaryInformation') {
      output.info.push(pageData.content);
    } else {
      log_debug('Found content with title', pageData.title, ':', pageData.content);
    }
  } else if (pageData.hasOwnProperty('detailedDescription')) {
    output.info.push(pageData.detailedDescription);
  }

  if (Array.isArray(pageData)) {
    for (const subData of pageData) {
      extractProductData(subData, output);
    }
  }
  else {
    for (const key in pageData) {
      if (Object.prototype.hasOwnProperty.call(pageData, key)) {
        extractProductData(pageData[key], output);
      }
    }
  }
}

/**
 * Fetches a value cooresponding to a key from local storage.
 **/
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

/**
 * Stores a value corresponding to a key in local storage.
 **/
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

/**
 * Fetches the given page and extracts product data in it.
 **/
async function fetchProductData(url) {
  const key = 'product::' + url;
  if (ENABLE_STORAGE) {
    const result = await fetchFromStorage(key);
    if (result !== undefined) {
        log_debug('Fetched product data for', url, 'from storage');
      return result;
    }
  }

  log_debug('Fetching', url);
  const response = await fetch(url);
  const text = await response.text();
  const pageData = extractPageData(text, url);
  const productData = {'ingredients': [], 'info': []};
  extractProductData(pageData, productData);

  if (productData.length === 0) {
    log_debug("No product data for", url);
  } else {
    log_debug("Found product data for", url, ":", productData);
  }
  if (ENABLE_STORAGE) {
    saveToStorage(key, productData);
  }
  return productData;
}

/**
 * Returns a clean, canonical version of the URL.
 */
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

// Install an event listener that responds to events receive from content.js.
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.sender === "ocado-allergens") {
      const url = cleanUrl(request.url);
      if (cache[url] === undefined) {
        cache[url] = fetchProductData(url);
      } 
      cache[url].then(sendResponse);
      return true;
    }
  }
);