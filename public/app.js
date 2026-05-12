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

const FAVORITES_KEY = "favoriteRecipes";
const RATINGS_KEY = "recipeRatings";

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

const getDietaryPreferences = () =>
  Array.from(document.querySelectorAll(".diet-checkbox:checked"))
    .map(i => i.value.toLowerCase());


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
    statusEl.textContent = "";
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
    return;
  }

  recipeList.innerHTML = results.map(r => {
    const isFav = favorites.includes(r.id);
    const rating = ratings[r.id] || 0;

   return `
  <article class="recipe-card">
    
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

    <button class="steps-toggle" data-id="${r.id}">
      ▶ View recipe steps
    </button>

    <div class="steps-content" data-id="${r.id}">
      
      <h4>Ingredients</h4>
      <ul>
        ${r.ingredients.map(i =>
          `<li>${i.quantity ?? ""} ${i.unit ?? ""} ${i.name}</li>`
        ).join("")}
      </ul>

      <h4>Steps</h4>
      <ol>
        ${r.steps.map(step => `<li>${step}</li>`).join("")}
      </ol>

      <h4>Nutrition</h4>
      <ul>
        <li>Calories: ${r.nutrition?.calories ?? 0}</li>
        <li>Protein: ${r.nutrition?.protein ?? 0} g</li>
        <li>Carbs: ${r.nutrition?.carbs ?? 0} g</li>
        <li>Fat: ${r.nutrition?.fat ?? 0} g</li>
      </ul>

    </div>

  </article>
`;

  }).join("");

  attachFavoriteHandlers();
  attachRatingHandlers();
   attachStepToggles(); 
   lucide.createIcons();

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
      <h3>${r.name}</h3>
      <p>${r.cuisine} · ${r.timeMinutes} mins</p>
    </article>
  `).join("");
};

const attachStepToggles = () => {
  const toggles = document.querySelectorAll(".steps-toggle");

  toggles.forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;

      // close all others
      document.querySelectorAll(".steps-content").forEach(c => {
        if (c.dataset.id !== id) {
          c.classList.remove("open");
        }
      });

      document.querySelectorAll(".steps-toggle").forEach(b => {
        if (b.dataset.id !== id) {
          b.textContent = "▶ View recipe steps";
        }
      });

      // toggle current
      const content = document.querySelector(`.steps-content[data-id="${id}"]`);
      const isOpen = content.classList.toggle("open");

      btn.textContent = isOpen
        ? "▼ Hide recipe steps"
        : "▶ View recipe steps";
    });
  });
};



/*************************************************
 * IMAGE RECOGNITION
 *************************************************/
const BROWSER_RECOGNITION_MIN_CONFIDENCE = 0.08;

const IMAGE_LABEL_TO_INGREDIENT = {
  "bell pepper": "bell pepper",
  broccoli: "broccoli",
  cauliflower: "cauliflower",
  cucumber: "cucumber",
  zucchini: "zucchini",
  courgette: "zucchini",
  mushroom: "mushroom",
  banana: "banana",
  lemon: "lemon",
  orange: "orange",
  pineapple: "pineapple",
  strawberry: "strawberry"
};

let browserIngredientModel;

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

const ingredientsFromImageLabels = (predictions) => {
  const ingredients = predictions
    .filter(prediction => prediction.probability >= BROWSER_RECOGNITION_MIN_CONFIDENCE)
    .flatMap(prediction => prediction.className.split(","))
    .map(label => label.trim().toLowerCase())
    .map(label => IMAGE_LABEL_TO_INGREDIENT[label])
    .filter(Boolean);

  return Array.from(new Set(ingredients));
};

const recognizeIngredientsInBrowser = async (file) => {
  const model = await getBrowserIngredientModel();

  if (!model) {
    return [];
  }

  const image = await fileToImageElement(file);
  const predictions = await model.classify(image, 10);
  return ingredientsFromImageLabels(predictions);
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

    if (serverIngredients.length) {
      return serverIngredients;
    }
  } catch (error) {
    console.debug("Backend image recognition failed:", error);
  }

  return recognizeIngredientsInBrowser(file);
};

imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  clearImageIngredients();
  imageHint.textContent = "Analyzing image...";

  try {
    recognizedIngredients = await recognizeIngredientsFromImage(file);
    syncSelectedIngredients();
    imageHint.textContent = recognizedIngredients.length
      ? "Ingredients detected from image."
      : "No ingredients detected.";
  } catch (error) {
    console.error(error);
    recognizedIngredients = [];
    renderRecognized();
    imageHint.textContent = "Could not analyze image.";
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
});


ingredientInput.addEventListener("input", () => {
  renderRecognized();
  rerunMatchIfPossible();
});

difficultySelect.addEventListener("change", rerunMatchIfPossible);
timeInput.addEventListener("input", rerunMatchIfPossible);
favoritesToggle.addEventListener("change", rerunMatchIfPossible);

document.querySelectorAll(".diet-checkbox").forEach(cb => {
  cb.addEventListener("change", rerunMatchIfPossible);
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
loadRecipes();

