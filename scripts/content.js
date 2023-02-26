const BANNER_ID = 'ocado-allergen-banner';
const BANNER_FLAG_CSS_CLASS = 'flag';
const BANNER_MESSAGE_CSS_CLASS = 'message';
const BANNER_HIDDEN_CSS_CLASS = 'hidden';
const ALLERGENS = ['egg', 'peanut'];

function getIngredients() {
  for (let element of document.querySelectorAll('.gn-accordionElement')) {
    if (element.innerText.startsWith('Ingredients')) {
      return element.innerText;
    }
  }
  return "";
}

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

function enableObserver() {
  observer.observe(document, { childList: true, subtree: true });
}

function disableObserver() {
  observer.disconnect();
}

function findAllergens(ingredients, allergens) {
  ingredients = ingredients.toLowerCase();
  const result = [];
  for (let allergen of allergens) {
    if (ingredients.includes(allergen.toLowerCase())) {
      result.push(allergen);
    } 
  }
  return result;
}

function updateAllergenBanner() {
  if (!document.URL.startsWith('https://www.ocado.com/products/')) {
    hideBanner();
    return;
  }

  const ingredients = getIngredients();
  const allergens = findAllergens(ingredients, ALLERGENS);

  if (ingredients === '') {
    showBanner('No ingredient information available for this product.', BANNER_FLAG_CSS_CLASS);
  } else if (allergens.length) {
    showBanner('<b>CAUTION</b>: This product contains or may contain <b>' + allergens.join(', ') + '</b>.', BANNER_FLAG_CSS_CLASS);
  } else {
    showBanner('No allergens found in ingredient list. Please double check!', BANNER_MESSAGE_CSS_CLASS);
  }
}

const observer = new MutationObserver(function(mutations) { 
  disableObserver();
  try {
    updateAllergenBanner();
  } finally {
    enableObserver();
  }
});

enableObserver();
