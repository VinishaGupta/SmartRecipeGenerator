/*************************************************
 * INGREDIENT DATA
 *************************************************/
const KNOWN_INGREDIENTS = [
  "tomato","onion","garlic","ginger","spinach","lettuce","kale","cabbage",
  "broccoli","cauliflower","carrot","bell pepper","chili pepper","zucchini",
  "cucumber","eggplant","peas","corn","mushroom","asparagus","celery",
  "sweet potato","potato",
  "apple","banana","lemon","lime","orange","avocado","berries","strawberry",
  "blueberry","grapes","pineapple","mango",
  "chicken","beef","pork","turkey","fish","salmon","tuna","shrimp","egg",
  "tofu","tempeh","lentils","chickpeas","beans","black beans",
  "rice","brown rice","quinoa","pasta","noodles","bread","tortilla","oats",
  "milk","cheese","mozzarella","parmesan","butter","yogurt","greek yogurt",
  "cream","coconut milk",
  "basil","cilantro","parsley","mint","oregano","thyme","rosemary",
  "pepper","salt","paprika","cumin","curry","chili powder"
];

const INGREDIENT_CATEGORIES = {
  Vegetables: ["tomato","onion","garlic","bell pepper","carrot","broccoli","spinach","zucchini","cucumber","mushroom","potato","sweet potato"],
  Fruits: ["apple","banana","lemon","lime","orange","avocado","berries","mango"],
  Proteins: ["chicken","beef","fish","salmon","shrimp","egg","tofu","lentils","chickpeas"],
  Grains: ["rice","quinoa","pasta","noodles","bread","tortilla"],
  Dairy: ["milk","cheese","yogurt","butter","cream"]
};

const DEFAULT_SUBSTITUTIONS = {
  milk: ["oat milk","soy milk","almond milk"],
  butter: ["olive oil","coconut oil"],
  egg: ["flax egg","chia egg"],
  chicken: ["tofu","chickpeas"],
  beef: ["mushrooms","lentils"],
  cheese: ["nutritional yeast","plant-based cheese"],
  yogurt: ["coconut yogurt","soy yogurt"],
  shrimp: ["king oyster mushrooms","tofu"]
};

/*************************************************
 * BACKEND
 *************************************************/
const RENDER_BACKEND_URL = "https://smartrecipegenerator-rbkj.onrender.com";
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;
const CLOUDINARY_CLOUD_NAME = "djsenbil3";
const RECIPE_IMAGE_FOLDER = "recipe-images";
const FALLBACK_RECIPE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23f1f5f9'/%3E%3Cpath d='M184 244h272c18 0 28-20 18-35l-42-64c-9-14-28-15-38-2l-30 39-18-22c-10-13-30-12-39 2l-42 63-21-25c-10-12-29-10-36 4l-35 40c-7 14 3 30 21 30z' fill='%23cbd5e1'/%3E%3Ccircle cx='220' cy='118' r='34' fill='%23cbd5e1'/%3E%3C/svg%3E";

const getBackendBaseUrl = () => {
  const host = window.location.hostname;

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".onrender.com")
  ) {
    return "";
  }

  return RENDER_BACKEND_URL;
};

const BACKEND_BASE_URL = getBackendBaseUrl();
const apiUrl = (path) => `${BACKEND_BASE_URL}${path}`;

const pingBackend = async () => {
  try {
    const response = await fetch(apiUrl("/health"), {
      cache: "no-store",
      mode: BACKEND_BASE_URL ? "cors" : "same-origin"
    });

    console.debug("Backend keepalive ping:", response.status);
  } catch (error) {
    console.debug("Backend ping failed:", error);
  }
};

const startBackendAutoPing = () => {
  pingBackend();
  setInterval(pingBackend, KEEP_ALIVE_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      pingBackend();
    }
  });
};

/*************************************************
 * DOM ELEMENTS
 *************************************************/
const ingredientInput = document.getElementById("ingredientInput");
const imageInput = document.getElementById("imageInput");
const ingredientSelector = document.getElementById("ingredientSelector");
const recognizedPills = document.getElementById("recognizedPills");
const matchButton = document.getElementById("matchButton");
const statusEl = document.getElementById("status");
const imageHint = document.getElementById("imageHint");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const imagePreview = document.getElementById("imagePreview");
const recipeList = document.getElementById("recipeList");
const suggestionList = document.getElementById("suggestionList");
const substitutionList = document.getElementById("substitutionList");
const difficultySelect = document.getElementById("difficultySelect");
const timeInput = document.getElementById("timeInput");
const favoritesToggle = document.getElementById("favoritesToggle");

/*************************************************
 * STATE
 *************************************************/
let recipes = [];
let recognizedIngredients = [];
let imagePreviewUrl = "";
let imagePreviewDataUrl = "";

const FAVORITES_KEY = "favoriteRecipes";
const RATINGS_KEY = "recipeRatings";
const SEARCH_STATE_KEY = "recipeSearchState";

const getFavorites = () =>
  JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");

const setFavorites = (favs) =>
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));

const getRatings = () =>
  JSON.parse(localStorage.getItem(RATINGS_KEY) || "{}");

const setRatings = (ratings) =>
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));


/*************************************************
 * HELPERS
 *************************************************/
const normalize = (v) => v.trim().toLowerCase();
const getRecipeUrl = (recipe) => `recipe.html?id=${encodeURIComponent(recipe.id)}`;
const getImageUrl = (imageName) =>
  imageName
    ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${RECIPE_IMAGE_FOLDER}/${imageName}`
    : FALLBACK_RECIPE_IMAGE;

const recipeImageMarkup = (recipe) => `
  <img
    class="recipe-card-image"
    src="${getImageUrl(recipe.image)}"
    alt="${recipe.name || "Recipe"}"
    loading="lazy"
  />
`;

const attachRecipeImageFallbacks = (root = document) => {
  root.querySelectorAll(".recipe-card-image").forEach(image => {
    image.addEventListener("error", () => {
      image.src = FALLBACK_RECIPE_IMAGE;
    }, { once: true });
  });
};

const getDietaryPreferences = () =>
  Array.from(document.querySelectorAll(".diet-checkbox:checked"))
    .map(i => i.value.toLowerCase());

const readSearchState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SEARCH_STATE_KEY) || "{}");
  } catch (error) {
    console.debug("Saved recipe search state could not be read:", error);
    return {};
  }
};

const saveSearchState = () => {
  const state = {
    ingredients: ingredientInput.value,
    recognizedIngredients,
    imagePreviewDataUrl,
    imageHint: imageHint.textContent,
    difficulty: difficultySelect.value,
    time: timeInput.value,
    favoritesOnly: favoritesToggle.checked,
    dietaryPreferences: getDietaryPreferences(),
    selectedIngredients: Array.from(
      document.querySelectorAll(".ingredient-checkbox:checked")
    ).map(cb => cb.value)
  };

  try {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.debug("Recipe search state could not be saved:", error);

    try {
      sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({ ...state, imagePreviewDataUrl: "" })
      );
    } catch (fallbackError) {
      console.debug("Recipe search state fallback could not be saved:", fallbackError);
    }
  }
};

const restoreSearchState = () => {
  const state = readSearchState();

  ingredientInput.value = state.ingredients || "";
  recognizedIngredients = Array.isArray(state.recognizedIngredients)
    ? state.recognizedIngredients.map(normalize).filter(Boolean)
    : [];

  difficultySelect.value = state.difficulty || "";
  timeInput.value = state.time ?? timeInput.value;
  favoritesToggle.checked = Boolean(state.favoritesOnly);

  const dietaryPreferences = new Set(
    (state.dietaryPreferences || []).map(normalize)
  );

  document.querySelectorAll(".diet-checkbox").forEach(cb => {
    cb.checked = dietaryPreferences.has(normalize(cb.value));
  });

  const selectedIngredients = new Set(
    (state.selectedIngredients || []).map(normalize)
  );

  document.querySelectorAll(".ingredient-checkbox").forEach(cb => {
    cb.checked = selectedIngredients.has(normalize(cb.value));
  });

  if (state.imagePreviewDataUrl) {
    imagePreviewDataUrl = state.imagePreviewDataUrl;
    imagePreview.src = imagePreviewDataUrl;
    imagePreviewWrap.hidden = false;
  }

  imageHint.textContent = state.imageHint || "";
  renderRecognized();
};


/*************************************************
 * INGREDIENT UI
 *************************************************/
const renderRecognized = () => {
  const items = ingredientInput.value
    .split(",")
    .map(normalize)
    .filter(Boolean);

  recognizedPills.innerHTML = items
    .map(i => `<span class="pill">${i}</span>`)
    .join("");
};

const syncSelectedIngredients = () => {
  const selected = Array.from(
    document.querySelectorAll(".ingredient-checkbox:checked")
  ).map(cb => cb.value);

  const manual = ingredientInput.value
    .split(",")
    .map(normalize)
    .filter(Boolean);

  const merged = Array.from(new Set([
    ...manual,
    ...selected,
    ...recognizedIngredients
  ]));

  ingredientInput.value = merged.join(", ");
  renderRecognized();
};

const clearImageIngredients = () => {
  const previousRecognized = new Set(recognizedIngredients.map(normalize));

  ingredientInput.value = ingredientInput.value
    .split(",")
    .map(normalize)
    .filter(Boolean)
    .filter(item => !previousRecognized.has(item))
    .join(", ");

  recognizedIngredients = [];
  renderRecognized();
};

const clearImagePreview = () => {
  if (imagePreviewUrl) {
    URL.revokeObjectURL(imagePreviewUrl);
    imagePreviewUrl = "";
  }

  imagePreviewDataUrl = "";
  imagePreview.removeAttribute("src");
  imagePreviewWrap.hidden = true;
};

const showImagePreview = (file) => {
  clearImagePreview();
  imagePreviewUrl = URL.createObjectURL(file);
  imagePreview.src = imagePreviewUrl;
  imagePreviewWrap.hidden = false;
};

/*************************************************
 * INGREDIENT SELECTOR
 *************************************************/
const renderIngredientSelector = () => {
  ingredientSelector.innerHTML = Object.entries(INGREDIENT_CATEGORIES)
    .map(([category, items]) => `
      <div class="dropdown">
        <div class="dropdown-header">
          ${category}
          <span>▼</span>
        </div>
        <div class="dropdown-content">
          ${items.map(item => `
            <label>
              <input type="checkbox" class="ingredient-checkbox" value="${item}">
              ${item}
            </label>
          `).join("")}
        </div>
      </div>
    `).join("");

  // ✅ THIS WAS MISSING — DROPDOWN TOGGLE
  document.querySelectorAll(".dropdown-header").forEach(header => {
    header.addEventListener("click", () => {
      const dropdown = header.parentElement;

      // close others (accordion behavior)
      document.querySelectorAll(".dropdown.open").forEach(d => {
        if (d !== dropdown) d.classList.remove("open");
      });

      dropdown.classList.toggle("open");
    });
  });

  // checkbox sync
  document.querySelectorAll(".ingredient-checkbox").forEach(cb => {
    cb.addEventListener("change", () => {
      syncSelectedIngredients();
      saveSearchState();
      rerunMatchIfPossible();
    });
  });
};


/*************************************************
 * SUBSTITUTIONS
 *************************************************/
const updateSubstitutions = () => {
  substitutionList.innerHTML = Object.entries(DEFAULT_SUBSTITUTIONS)
    .slice(0,4)
    .map(([k,v]) => `<li><strong>${k}:</strong> ${v.join(", ")}</li>`)
    .join("");
};

/*************************************************
 * RECIPES
 *************************************************/
const loadRecipes = async () => {
  try {
    const res = await fetch(apiUrl("/api/recipes"));
    recipes = await res.json();
    renderSuggestions();
    if (ingredientInput.value.trim()) {
      renderRecipes(matchRecipes());
    } else {
      statusEl.textContent = "";
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "";
  }
};

const scoreRecipe = (recipe, available) => {
  const recipeIngredients = recipe.ingredients.map(i =>
    normalize(i.name)
  );

  const matched = recipeIngredients.filter(ri =>
    available.some(ai =>
      ri.includes(ai) || ai.includes(ri)
    )
  );

  return {
    matchedCount: matched.length,
    total: recipeIngredients.length
  };
};


const matchRecipes = () => {
  const available = ingredientInput.value
    .split(",")
    .map(normalize)
    .filter(Boolean);

  if (!available.length) {
    statusEl.textContent = "Please add ingredients.";
    return [];
  }

  const dietaryPrefs = getDietaryPreferences();
  const selectedDifficulty = difficultySelect.value;
  const maxTime = Number(timeInput.value);

  const results = recipes
    // DIETARY FILTER
    .filter(r => {
      if (!dietaryPrefs.length) return true;
      return dietaryPrefs.every(pref =>
        (r.dietaryTags || []).map(normalize).includes(pref)
      );
    })

    // DIFFICULTY FILTER
    .filter(r => {
      if (!selectedDifficulty) return true;
      return normalize(r.difficulty) === normalize(selectedDifficulty);
    })

    // TIME FILTER
    .filter(r => {
      if (!maxTime) return true;
      return r.timeMinutes <= maxTime;
    })

    // 🔥 ADD MATCH SCORE BACK
    .map(r => {
      const score = scoreRecipe(r, available);
      return { ...r, ...score };
    })

    // ONLY SHOW RECIPES THAT MATCH AT LEAST 1 INGREDIENT
    .filter(r => r.matchedCount > 0)

    .sort((a, b) => b.matchedCount - a.matchedCount);

  statusEl.textContent = `${results.length} recipes matched.`;
  return results;
};





const renderRecipes = (results) => {
  const favorites = getFavorites();
  const ratings = getRatings();

  if (!results.length) {
    recipeList.innerHTML = "<p>No recipes found.</p>";
    saveSearchState();
    return;
  }

  recipeList.innerHTML = results.map(r => {
    const isFav = favorites.includes(r.id);
    const rating = ratings[r.id] || 0;

   return `
  <article class="recipe-card">
    ${recipeImageMarkup(r)}
    
    <div class="recipe-header">
      <h3>${r.name}</h3>

      <button 
        class="fav-btn ${isFav ? "active" : ""}" 
        data-id="${r.id}"
        title="Toggle favorite"
      >
        <i data-lucide="heart"></i>
      </button>
    </div>

    <div class="recipe-meta">
      <span><strong>Cuisine:</strong> ${r.cuisine || "N/A"}</span>
      <span><strong>Difficulty:</strong> ${r.difficulty || "N/A"}</span>
      <span><strong>Time:</strong> ${r.timeMinutes} mins</span>
      <span><strong>Servings:</strong> ${r.servings}</span>
    </div>

    <p>
      <strong>Matched:</strong> ${r.matchedCount} / ${r.total} ingredients
    </p>

    <div class="tags">
      ${(r.dietaryTags || []).map(tag =>
        `<span class="tag">${tag}</span>`
      ).join("")}
    </div>

    <div class="rating" data-id="${r.id}">
      ${[1,2,3,4,5].map(star => `
        <span 
          class="star ${star <= rating ? "filled" : ""}" 
          data-star="${star}"
        >★</span>
      `).join("")}
    </div>

    <a class="recipe-link" href="${getRecipeUrl(r)}">
      View Recipe
    </a>

  </article>
`;

  }).join("");

  attachFavoriteHandlers();
  attachRatingHandlers();
  attachRecipeImageFallbacks(recipeList);
  recipeList.querySelectorAll(".recipe-link").forEach(link => {
    link.addEventListener("click", saveSearchState);
  });
  lucide.createIcons();
  saveSearchState();

};

const attachFavoriteHandlers = () => {
  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      let favs = getFavorites();

      if (favs.includes(id)) {
        favs = favs.filter(f => f !== id);
      } else {
        favs.push(id);
      }

      setFavorites(favs);
      renderRecipes(matchRecipes());
    });
  });
};

const attachRatingHandlers = () => {
  document.querySelectorAll(".rating").forEach(container => {
    const id = container.dataset.id;

    container.querySelectorAll(".star").forEach(star => {
      star.addEventListener("click", () => {
        const value = Number(star.dataset.star);
        const ratings = getRatings();
        ratings[id] = value;
        setRatings(ratings);
        renderRecipes(matchRecipes());
      });
    });
  });
};



const renderSuggestions = () => {
  if (!suggestionList) {
    return;
  }

  const favs = getFavorites();

  // favorite recipes first
  let suggested = recipes.filter(r => favs.includes(String(r.id))
);

  // fallback if no favorites
  if (!suggested.length) {
    suggested = recipes.slice(0, 3);
  } else {
    suggested = suggested.slice(0, 3);
  }

  suggestionList.innerHTML = suggested.map(r => `
    <article class="recipe-card">
      ${recipeImageMarkup(r)}
      <h3>${r.name}</h3>
      <p>${r.cuisine} · ${r.timeMinutes} mins</p>
    </article>
  `).join("");
  attachRecipeImageFallbacks(suggestionList);
};

/*************************************************
 * IMAGE RECOGNITION
 *************************************************/
const BROWSER_RECOGNITION_MIN_CONFIDENCE = 0.05;
const STALE_FALLBACK_INGREDIENT_KEY = "bell pepper|cucumber|zucchini";
const IMAGE_CROP_REGIONS = [
  [0, 0, 1, 1],
  [0, 0, 0.5, 0.5],
  [0.5, 0, 0.5, 0.5],
  [0, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
  [0.2, 0.2, 0.6, 0.6]
];

const IMAGE_LABEL_TO_INGREDIENT = {
  acorn: "zucchini",
  artichoke: "asparagus",
  banana: "banana",
  "bell pepper": "bell pepper",
  broccoli: "broccoli",
  cauliflower: "cauliflower",
  corn: "corn",
  courgette: "zucchini",
  cucumber: "cucumber",
  eggplant: "eggplant",
  fig: "berries",
  "granny smith": "apple",
  "head cabbage": "cabbage",
  lemon: "lemon",
  mushroom: "mushroom",
  orange: "orange",
  pineapple: "pineapple",
  pomegranate: "berries",
  "red cabbage": "cabbage",
  "spaghetti squash": "zucchini",
  strawberry: "strawberry",
  "butternut squash": "zucchini",
  zucchini: "zucchini"
};

let browserIngredientModel;

const ingredientKey = (ingredients) =>
  ingredients.map(normalize).sort().join("|");

const removeStaleFallbackIngredients = (ingredients) => {
  const uniqueIngredients = Array.from(new Set(ingredients));

  if (ingredientKey(uniqueIngredients) === STALE_FALLBACK_INGREDIENT_KEY) {
    return [];
  }

  return uniqueIngredients;
};

const mergeImageIngredients = (...ingredientGroups) =>
  removeStaleFallbackIngredients(
    Array.from(new Set(
      ingredientGroups
        .flat()
        .map(normalize)
        .filter(ingredient => KNOWN_INGREDIENTS.includes(ingredient))
    ))
  );

const getBrowserIngredientModel = async () => {
  if (!window.mobilenet) {
    return null;
  }

  if (!browserIngredientModel) {
    browserIngredientModel = await window.mobilenet.load();
  }

  return browserIngredientModel;
};

const fileToImageElement = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Image could not be loaded"));
  };

  image.src = objectUrl;
});

const createStoredPreviewDataUrl = async (file) => {
  const image = await fileToImageElement(file);
  const canvas = document.createElement("canvas");
  const maxSide = 720;
  const scale = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight, 1);

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", 0.82);
};

const cropImageElement = (image, region) => {
  const [xRatio, yRatio, widthRatio, heightRatio] = region;
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    image.naturalWidth * xRatio,
    image.naturalHeight * yRatio,
    image.naturalWidth * widthRatio,
    image.naturalHeight * heightRatio,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
};

const rgbToHsl = (red, green, blue) => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) {
    return [0, 0, lightness];
  }

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);

  let hue;
  if (max === r) {
    hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
  } else if (max === g) {
    hue = ((b - r) / delta + 2) * 60;
  } else {
    hue = ((r - g) / delta + 4) * 60;
  }

  return [hue, saturation, lightness];
};

const inferProduceFromColors = (image) => {
  const canvas = document.createElement("canvas");
  const maxSide = 180;
  const scale = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight, 1);

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const counts = {
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
    darkGreen: 0,
    purple: 0,
    brown: 0
  };
  let coloredPixels = 0;

  for (let i = 0; i < data.length; i += 16) {
    const [hue, saturation, lightness] = rgbToHsl(data[i], data[i + 1], data[i + 2]);

    if (saturation < 0.22 || lightness < 0.08 || lightness > 0.94) {
      continue;
    }

    coloredPixels += 1;

    if (hue >= 20 && hue < 55 && lightness < 0.45) counts.brown += 1;

    if (hue < 18 || hue >= 345) counts.red += 1;
    else if (hue < 45) counts.orange += 1;
    else if (hue < 70) counts.yellow += 1;
    else if (hue < 165) {
      counts.green += 1;
      if (lightness < 0.42) counts.darkGreen += 1;
    } else if (hue >= 250 && hue < 330) counts.purple += 1;
  }

  if (!coloredPixels) {
    return [];
  }

  const ratio = (color) => counts[color] / coloredPixels;
  const inferred = [];

  if (ratio("red") > 0.045) inferred.push("tomato");
  if (ratio("orange") > 0.045) inferred.push("carrot");
  if (ratio("yellow") > 0.06) inferred.push("corn");
  if (ratio("green") > 0.08) inferred.push("cucumber", "zucchini");
  if (ratio("darkGreen") > 0.035) inferred.push("broccoli");
  if (ratio("purple") > 0.025) inferred.push("eggplant");
  if (ratio("brown") > 0.08) inferred.push("potato");

  if (ratio("red") > 0.025 && ratio("green") > 0.025) {
    inferred.push("bell pepper");
  }

  return mergeImageIngredients(inferred);
};

const ingredientsFromImageLabels = (predictions) => {
  const ingredients = predictions
    .filter(prediction => prediction.probability >= BROWSER_RECOGNITION_MIN_CONFIDENCE)
    .flatMap(prediction => prediction.className.split(","))
    .map(label => label.trim().toLowerCase())
    .map(label => IMAGE_LABEL_TO_INGREDIENT[label])
    .filter(Boolean);

  return removeStaleFallbackIngredients(ingredients);
};

const recognizeIngredientsInBrowser = async (file) => {
  const image = await fileToImageElement(file);
  const colorIngredients = inferProduceFromColors(image);
  const model = await getBrowserIngredientModel();

  if (!model) {
    return colorIngredients;
  }

  const predictionsByRegion = await Promise.all(
    IMAGE_CROP_REGIONS.map(region => model.classify(cropImageElement(image, region), 8))
  );
  const predictions = predictionsByRegion.flat();

  console.debug("Browser image predictions:", predictions);
  return mergeImageIngredients(ingredientsFromImageLabels(predictions), colorIngredients);
};

const recognizeIngredientsFromImage = async (file) => {
  const reader = new FileReader();
  const base64 = await new Promise((res, rej) => {
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  try {
    const res = await fetch(apiUrl("/api/recognize"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 })
    });

    const data = await res.json();
    const serverIngredients = (data.predictions || [])
      .map(p => normalize(p.label))
      .filter(l => KNOWN_INGREDIENTS.includes(l));

    const browserIngredients = await recognizeIngredientsInBrowser(file);
    return mergeImageIngredients(serverIngredients, browserIngredients);
  } catch (error) {
    console.debug("Backend image recognition failed:", error);
  }

  return recognizeIngredientsInBrowser(file);
};

imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) {
    clearImagePreview();
    saveSearchState();
    return;
  }

  clearImageIngredients();
  showImagePreview(file);
  imageHint.textContent = "Analyzing image...";

  try {
    const [storedPreview, ingredients] = await Promise.all([
      createStoredPreviewDataUrl(file),
      recognizeIngredientsFromImage(file)
    ]);

    imagePreviewDataUrl = storedPreview;
    recognizedIngredients = ingredients;
    syncSelectedIngredients();
    imageHint.textContent = recognizedIngredients.length
      ? "Ingredients detected from image."
      : "No ingredients detected.";
    saveSearchState();
  } catch (error) {
    console.error(error);
    recognizedIngredients = [];
    renderRecognized();
    imageHint.textContent = "Could not analyze image.";
    saveSearchState();
  }
});


/*************************************************
 * EVENTS
 *************************************************/

matchButton.addEventListener("click", () => {
  console.log("Button clicked");

  const results = matchRecipes();
  console.log("Matched results:", results);

  renderRecipes(results);
  saveSearchState();
});


ingredientInput.addEventListener("input", () => {
  renderRecognized();
  saveSearchState();
  rerunMatchIfPossible();
});

difficultySelect.addEventListener("change", () => {
  saveSearchState();
  rerunMatchIfPossible();
});

timeInput.addEventListener("input", () => {
  saveSearchState();
  rerunMatchIfPossible();
});

favoritesToggle.addEventListener("change", () => {
  saveSearchState();
  rerunMatchIfPossible();
});

document.querySelectorAll(".diet-checkbox").forEach(cb => {
  cb.addEventListener("change", () => {
    saveSearchState();
    rerunMatchIfPossible();
  });
});


function rerunMatchIfPossible() {
  if (recipes.length) renderRecipes(matchRecipes());
};



const viewFavoritesBtn = document.getElementById("viewFavoritesBtn");

viewFavoritesBtn.addEventListener("click", () => {
  const favs = getFavorites();

  if (!favs.length) {
    recipeList.innerHTML = "<p>No favorite recipes yet.</p>";
    return;
  }

  const favRecipes = recipes.map(r => {
    const score = scoreRecipe(r, ingredientInput.value.split(",").map(normalize));
    return { ...r, ...score };
  }).filter(r => favs.includes(String(r.id))
);

  renderRecipes(favRecipes);
});

/*************************************************
 * INIT
 *************************************************/
startBackendAutoPing();
updateSubstitutions();
renderIngredientSelector();
restoreSearchState();
loadRecipes();

