const BANNER_ID = 'ocado-allergen-banner';
const BANNER_FLAG_CSS_CLASS = 'flag';
const BANNER_MESSAGE_CSS_CLASS = 'message';
const BANNER_HIDDEN_CSS_CLASS = 'hidden';
const ALLERGENS = ['egg'];

let userInterfaceNeedUpdating = false;
const banner = {text: '', cssClass: ''};
const linksSeen = [];

/*********************
 * UTILITY FUNCTIONS *
 *********************/

function isProductPage(url) {
  return url.startsWith('https://www.ocado.com/products/') || url.startsWith('https://www.ocado.com/webshop/product/');
}

/*******************
 * ALLERGEN BANNER * 
 *******************/

function getBannerElement() {
  const mainContent = document.querySelector('#main-content');
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

function updateBanner() {
  const bannerElement = getBannerElement();
  if (bannerElement === null) {
    return;
  }
  if (banner.text === '') {
    bannerElement.className = BANNER_HIDDEN_CSS_CLASS;
  } else {
    bannerElement.className = banner.cssClass;
    bannerElement.innerHTML = banner.text;
  }
}

async function updateProductAllergenBanner() {
  const ingredients = await fetchIngredients(document.URL);
  const allergens = findAllergens(ingredients);

  if (Object.keys(ingredients).length === 0) {
    banner.text = 'No ingredient information available for this product.'
    banner.cssClass = BANNER_FLAG_CSS_CLASS;
  } else if (allergens.size > 0) {
    const allergensString = Array.from(allergens).sort().join(', ');
    banner.text = '<b>CAUTION</b>: This product contains or may contain <b>' + allergensString + '</b>.';
    banner.cssClass = BANNER_FLAG_CSS_CLASS;
  } else {
    banner.text = 'No allergens found in ingredient list. Please double check!';
    banner.cssClass = BANNER_MESSAGE_CSS_CLASS;
  }
  invalidateUI();
}

/************************************
 * INGREDIENT AND ALLERGEN FETCHING *
 ************************************/

async function fetchIngredients(url) {
  return chrome.runtime.sendMessage({sender: "ocado-allergens", url: url});
}

function findAllergens(ingredients) {
  const result = new Set();
  for (const [key, value] of Object.entries(ingredients)) {
    let line = value.content.toLowerCase();
    for (let allergen of ALLERGENS) {
      if (line.includes(allergen.toLowerCase())) {
        result.add(allergen);
      }
    } 
  }
  return result;
}

/************************************
 * INGREDIENT AND ALLERGEN FETCHING *
 ************************************/

async function updateAllergenFlag(link) {
  const ingredients = await fetchIngredients(link.href);
  const allergens = findAllergens(ingredients);

  if (allergens.size > 0) {
    link.flag = 'red';
  } else {
    link.flag = 'green';
  }
  invalidateUI();
}

function installLinkObserver(link) {
  if (link.observer !== undefined) {
    return;
  }

  link.observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.intersectionRatio > 0) {
        link.observer.disconnect();
        link.observer = null;
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
      banner.text = '';
      installLinkObservers();
    }
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

function updateUserInterface() {
  if (!userInterfaceNeedUpdating) {
    return;
  }
  disableMutationObserver();
  try {
    updateBanner();
    for (var link of linksSeen) {
      const content = link.querySelector('.fop-content');
      if (content !== null) {
        if (link.flag === undefined) {
          content.style.border = '1px dashed black';
        } else {
          content.style.border = '4px solid ' + link.flag;
        }
      }
    }
  } finally {
    enableMutationObserver();
  }
}

function invalidateUI() {
  userInterfaceNeedUpdating = true;
}

function enableUserInterfaceUpdateTimer() {
  window.setInterval(updateUserInterface, 50);
}

if (document.URL.startsWith('https://www.ocado.com/')) {
  enableMutationObserver();
  enableUserInterfaceUpdateTimer();
}
