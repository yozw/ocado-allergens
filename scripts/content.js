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

async function fetchIngredients(url) {
  return chrome.runtime.sendMessage({sender: "ocado-allergens", url: url});
}

async function updateAllergenBanner() {
  if (!document.URL.startsWith('https://www.ocado.com/products/')) {
    hideBanner();
    return;
  }

  const ingredientsDict = await fetchIngredients(document.URL);

  let ingredients = "";
  for (const [key, value] of Object.entries(ingredientsDict)) {
    ingredients += "\n" + value.content;
  }

  console.log(ingredients);

  const allergens = findAllergens(ingredients, ALLERGENS);

  if (ingredients === '') {
    showBanner('No ingredient information available for this product.', BANNER_FLAG_CSS_CLASS);
  } else if (allergens.length) {
    showBanner('<b>CAUTION</b>: This product contains or may contain <b>' + allergens.join(', ') + '</b>.', BANNER_FLAG_CSS_CLASS);
  } else {
    showBanner('No allergens found in ingredient list. Please double check!', BANNER_MESSAGE_CSS_CLASS);
  }
}

const observer = new MutationObserver(async function(mutations) { 
  disableObserver();
  try {
    await updateAllergenBanner();
  } finally {
    enableObserver();
  }
});

enableObserver();
