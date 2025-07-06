/*

TODO:

* Trolley page does not show flags (only if you click on an item).
*/

const BANNER_ID = 'ocado-allergen-banner';
const BANNER_FLAG_CSS_CLASS = 'flag';
const BANNER_MESSAGE_CSS_CLASS = 'message';
const BANNER_HIDDEN_CSS_CLASS = 'hidden';
const ALLERGENS = ['egg'];
const DEBUG = true;

let userInterfaceNeedUpdating = false;
const banner = {text: '', cssClass: '', needsUpdating: false};
const linksSeen = [];

function log_debug(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

/*********************
 * UTILITY FUNCTIONS *
 *********************/

function isProductPage(url) {
  return url.startsWith('https://www.ocado.com/products/') || url.startsWith('https://www.ocado.com/webshop/product/')
  || url.startsWith('https://ww2.ocado.com/products/') || url.startsWith('https://ww2.ocado.com/webshop/product/');
}

/*******************
 * ALLERGEN BANNER * 
 *******************/

function getBannerElement() {
  const mainContent = document.querySelector('#main');
  if (!mainContent) {
    return null;
  }
  let element = document.querySelector('#' + BANNER_ID);
  if (element === null) {
    element = document.createElement('div');
    element.id = BANNER_ID;
    mainContent.insertBefore(element, mainContent.firstChild);
  }
  return element;
}

function setBanner(text, cssClass) {
  banner.text = text;
  banner.cssClass = (text !== '') ? cssClass : BANNER_HIDDEN_CSS_CLASS;
  invalidateUI();
}

function updateBanner() {
  if (banner.needsUpdating) {
    const bannerElement = getBannerElement();
    if (bannerElement !== null) {
      banner.needsUpdating = false;
      bannerElement.className = banner.cssClass;
      bannerElement.innerHTML = banner.text;
    }
  }
}

async function updateProductAllergenBanner() {
  const ingredients = await fetchIngredients(document.URL);
  if (!ingredients) {
    setBanner('No ingredient information available for this product.', BANNER_FLAG_CSS_CLASS);
    return;    
  }

  const allergens = findAllergens(ingredients);

  if (allergens.size > 0) {
    const allergensString = Array.from(allergens).sort().join(', ');
    setBanner('<b>CAUTION</b>: This product contains or may contain <b>' + allergensString + '</b>.', BANNER_FLAG_CSS_CLASS);
  } else {
    setBanner('No allergens found in ingredient list. Please double check!', BANNER_MESSAGE_CSS_CLASS);
  }
}

/************************************
 * INGREDIENT AND ALLERGEN FETCHING *
 ************************************/

async function fetchIngredients(url) {
  return chrome.runtime.sendMessage({sender: "ocado-allergens", url: url});
}

function findAllergens(ingredients) {
  const result = new Set();
  let line = ingredients.toLowerCase();
  for (let allergen of ALLERGENS) {
    if (line.includes(allergen.toLowerCase())) {
      result.add(allergen);
    }
  } 
  return result;
}

/************************************
 * INGREDIENT AND ALLERGEN FETCHING *
 ************************************/

async function updateAllergenFlag(link) {
  const ingredients = await fetchIngredients(link.href);
  if (!ingredients) {
    link.flag = 'unknown';
  } else {
    const allergens = findAllergens(ingredients);

    if (allergens.size > 0) {
      link.flag = 'flag';
    } else {
      link.flag = 'check';
    }
  }
  invalidateUI();
}

function installLinkObserver(link) {
  if (link.observer !== undefined) {
    return;
  }

  link.flag = 'loading';

  link.observer = new IntersectionObserver((entries, observer) => {
    log_debug("Looking for product links");
    entries.forEach(entry => {
      if (entry.intersectionRatio > 0) {
        link.observer.disconnect();
        link.observer = null;
        log_debug("Found a link to a product:", link);
        linksSeen.push(link);
        updateAllergenFlag(link);
      }
    });
  }, {});

  link.observer.observe(link);
}

function installLinkObservers() {
  const links = document.querySelectorAll("a");
  for (let link of links) {
    if (isProductPage(link.href)) {
      installLinkObserver(link);
    }  
  }
}


/**********************
 * MUTATION OBSERVERS *
 **********************/

function createMutationObserver() {
  return new MutationObserver(function(mutations) { 
    if (isProductPage(document.URL)) {
      updateProductAllergenBanner();
    } else {
      setBanner('');
    }
    installLinkObservers();
  });
}

function enableMutationObserver() {
  mutationObserver.observe(document, { childList: true, subtree: true });
}

function disableMutationObserver() {
  mutationObserver.disconnect();
}

const mutationObserver = createMutationObserver();

/******************************
 * USER INTERFACE UPDATE LOOP *
 ******************************/

function setOneOfClass(element, prefix, postfix) {
  const newClassName = prefix + postfix;
  let needsAdding = true;
  for (const className of element.classList) {
    if (className == newClassName) {
      needsAdding = false;
    } else if (className.startsWith(prefix)) {
      element.classList.remove(className);
    }
  }
  if (needsAdding) {
    element.classList.add(newClassName);
  }
}

function updateUserInterface() {
  if (!userInterfaceNeedUpdating) {
    return;
  }
  disableMutationObserver();
  try {
    updateBanner();
    // TODO: Put the image in a div.
    for (var link of linksSeen) {
      if (link.flag === undefined) {
        continue;
      }
      const parent = link.parentNode;
      if (!parent) {
        log_debug("Could not determine the parent of the anchor")
        continue;
      }
      if (parent.classList.contains("title-container")) {
        continue;
      }
      setOneOfClass(parent, 'ocado-allergen-', link.flag);
    }
  } finally {
    enableMutationObserver();
  }
}

function invalidateUI() {
  userInterfaceNeedUpdating = true;
  banner.needsUpdating = true;
}

function enableUserInterfaceUpdateTimer() {
  window.setInterval(updateUserInterface, 50);
}

if (document.URL.startsWith('https://www.ocado.com/') || document.URL.startsWith('https://ww2.ocado.com/')) {
  enableMutationObserver();
  enableUserInterfaceUpdateTimer();
}
