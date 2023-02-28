const BANNER_ID = 'ocado-allergen-banner';
const BANNER_FLAG_CSS_CLASS = 'flag';
const BANNER_MESSAGE_CSS_CLASS = 'message';
const BANNER_HIDDEN_CSS_CLASS = 'hidden';
const ALLERGENS = ['egg'];

function getBannerElement() {
  const mainContent = document.querySelector('#main-content');
  if (!mainContent) {
    return null;
  }
  let element = document.querySelector('#' + BANNER_ID);
  if (!element) {
    element = document.createElement('div');
    element.id = BANNER_ID;
    mainContent.insertBefore(element, mainContent.firstChild);
  }
  return element;
}

function showBanner(html, className) {
  const alertDiv = getBannerElement();
  alertDiv.className = className;
  alertDiv.innerHTML = html;
}

function hideBanner(html) {
  const alertDiv = getBannerElement();
  if (alertDiv != null) {
    alertDiv.className = BANNER_HIDDEN_CSS_CLASS;
  }
}

let observerStackDepth = 1;

function enableObserver() {
  observerStackDepth--;
  if (observerStackDepth === 0) {
    observer.observe(document, { childList: true, subtree: true });
  }
}

function disableObserver() {
  if (observerStackDepth === 0) {
    observer.disconnect();
  }
  observerStackDepth++;
}

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

function isProductPage(url) {
  return url.startsWith('https://www.ocado.com/products/') || url.startsWith('https://www.ocado.com/webshop/product/');
}

async function updateLink(link) {
  const href = link.href;
  if (!isProductPage(href)) {
    return;
  }
  
  const content = link.querySelector('.fop-content');
  if (content === null) {
    return;
  }

  content.style.border = '2px dashed black';

  const ingredients = await fetchIngredients(href);
  const allergens = findAllergens(ingredients);
  if (allergens.size > 0) {
    content.style.border = '4px solid red';
  } else {
    content.style.border = '2px solid green';
  }
}

async function updateLinks() {
  const links = document.querySelectorAll("a");
  for (let link of links) {
    updateLink(link);
  }
}

async function updateContent() {
  if (!document.URL.startsWith('https://www.ocado.com/')) {
    return;
  }

  updateLinks();

  if (!isProductPage(document.URL)) {
    hideBanner();
    return;
  }

  const ingredients = await fetchIngredients(document.URL);
  const allergens = findAllergens(ingredients);

  if (Object.keys(ingredients).length === 0) {
    showBanner('No ingredient information available for this product.', BANNER_FLAG_CSS_CLASS);
  } else if (allergens.size > 0) {
    const allergensString = Array.from(allergens).sort().join(', ');
    showBanner('<b>CAUTION</b>: This product contains or may contain <b>' + allergensString + '</b>.', BANNER_FLAG_CSS_CLASS);
  } else {
    showBanner('No allergens found in ingredient list. Please double check!', BANNER_MESSAGE_CSS_CLASS);
  }
}

const observer = new MutationObserver(async function(mutations) { 
  disableObserver();
  try {
    await updateContent();
  } finally {
    enableObserver();
  }
});

enableObserver();
