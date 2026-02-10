const KNOWN_INGREDIENTS = [
  // Vegetables
  "tomato",
  "onion",
  "garlic",
  "ginger",
  "spinach",
  "lettuce",
  "kale",
  "cabbage",
  "broccoli",
  "cauliflower",
  "carrot",
  "bell pepper",
  "chili pepper",
  "zucchini",
  "cucumber",
  "eggplant",
  "peas",
  "corn",
  "mushroom",
  "asparagus",
  "celery",
  "sweet potato",
  "potato",

  // Fruits
  "apple",
  "banana",
  "lemon",
  "lime",
  "orange",
  "avocado",
  "berries",
  "strawberry",
  "blueberry",
  "grapes",
  "pineapple",
  "mango",

  // Proteins
  "chicken",
  "beef",
  "pork",
  "turkey",
  "fish",
  "salmon",
  "tuna",
  "shrimp",
  "egg",
  "tofu",
  "tempeh",
  "lentils",
  "chickpeas",
  "beans",
  "black beans",

  // Grains & carbs
  "rice",
  "brown rice",
  "quinoa",
  "pasta",
  "noodles",
  "bread",
  "tortilla",
  "oats",

  // Dairy & alternatives
  "milk",
  "cheese",
  "mozzarella",
  "parmesan",
  "butter",
  "yogurt",
  "greek yogurt",
  "cream",
  "coconut milk",

  // Herbs & spices
  "basil",
  "cilantro",
  "parsley",
  "mint",
  "oregano",
  "thyme",
  "rosemary",
  "pepper",
  "salt",
  "paprika",
  "cumin",
  "curry",
  "chili powder",

  // Oils & condiments
  "olive oil",
  "soy sauce",
  "vinegar",
  "balsamic",
  "honey",
  "maple syrup",
  "mustard",

  // Common dishes (vision models output these often)
  "salad",
  "soup",
  "stir fry",
  "noodles",
  "ramen",
  "pasta dish",
  "curry",
  "sandwich",
  "burger",
  "pizza",
  "taco"
];


const DEFAULT_SUBSTITUTIONS = {
  milk: ["oat milk", "soy milk", "almond milk"],
  butter: ["olive oil", "coconut oil"],
  egg: ["flax egg", "chia egg"],
  chicken: ["tofu", "chickpeas"],
  beef: ["mushrooms", "lentils"],
  wheat: ["gluten-free flour", "almond flour"],
  cheese: ["nutritional yeast", "plant-based cheese"],
  yogurt: ["coconut yogurt", "soy yogurt"],
  shrimp: ["king oyster mushrooms", "tofu"],
  honey: ["maple syrup", "agave"]
};

const ingredientInput = document.getElementById("ingredientInput");
const imageInput = document.getElementById("imageInput");
const recognizedPills = document.getElementById("recognizedPills");
const matchButton = document.getElementById("matchButton");
const statusEl = document.getElementById("status");
const imageHint = document.getElementById("imageHint");
const recipeList = document.getElementById("recipeList");
const suggestionList = document.getElementById("suggestionList");
const substitutionList = document.getElementById("substitutionList");
const difficultySelect = document.getElementById("difficultySelect");
const timeInput = document.getElementById("timeInput");
const servingsInput = document.getElementById("servingsInput");
const favoritesToggle = document.getElementById("favoritesToggle");

let recipes = [];
let recognizedIngredients = [];

const INGREDIENT_MAP = {
  pizza: ["tomato", "cheese", "basil"],
  burger: ["beef", "onion", "tomato"],
  spaghetti: ["pasta", "tomato", "garlic"],
  salad: ["lettuce", "tomato", "cucumber"],
  curry: ["onion", "garlic", "tomato"],
  sandwich: ["bread", "cheese", "tomato"],
  soup: ["onion", "carrot", "celery"],
  taco: ["tortilla", "beef", "avocado"],
  sushi: ["rice", "salmon", "avocado"],
  ramen: ["noodles", "egg", "spinach"],
  omelette: ["egg", "cheese", "spinach"],
  steak: ["beef", "garlic"],
  chicken: ["chicken", "garlic"],
  salmon: ["salmon", "lemon"]
};

const normalize = (value) => value.trim().toLowerCase();
const getDietaryPreferences = () =>
  Array.from(document.querySelectorAll("input[type='checkbox']:checked")).map((input) =>
    input.value
  );

const updateSubstitutions = () => {
  const items = Object.entries(DEFAULT_SUBSTITUTIONS)
    .slice(0, 4)
    .map(
      ([key, list]) => `<li><strong>${key}:</strong> ${list.join(", ")}</li>`
    )
    .join("");
  substitutionList.innerHTML = items;
};

const renderRecognized = () => {
  recognizedPills.innerHTML = recognizedIngredients
    .map((ingredient) => `<span class="pill">${ingredient}</span>`)
    .join("");
};

const loadRecipes = async () => {
  statusEl.textContent = "Loading recipes...";
  const response = await fetch("/api/recipes");
  recipes = await response.json();
  statusEl.textContent = "Ready to generate recipes.";
  renderSuggestions();
};

const getStoredRatings = () => JSON.parse(localStorage.getItem("ratings") || "{}");
const getStoredFavorites = () =>
  new Set(JSON.parse(localStorage.getItem("favorites") || "[]"));

const storeRatings = (ratings) =>
  localStorage.setItem("ratings", JSON.stringify(ratings));
const storeFavorites = (favorites) =>
  localStorage.setItem("favorites", JSON.stringify(Array.from(favorites)));

const scoreRecipe = (recipe, availableIngredients) => {
  const recipeIngredients = recipe.ingredients.map((item) => normalize(item.name));
  const matches = recipeIngredients.filter((ingredient) =>
    availableIngredients.includes(ingredient)
  );
  return matches.length / recipeIngredients.length;
};

const adjustServings = (recipe, targetServings) => {
  if (!targetServings || targetServings === recipe.servings) {
    return recipe;
  }
  const scale = targetServings / recipe.servings;
  return {
    ...recipe,
    servings: targetServings,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: Number((ingredient.quantity * scale).toFixed(2))
    })),
    nutrition: Object.fromEntries(
      Object.entries(recipe.nutrition).map(([key, value]) => [
        key,
        Number((value * scale).toFixed(0))
      ])
    )
  };
};

const matchesDietary = (recipe, dietaryPreferences) => {
  if (!dietaryPreferences.length) {
    return true;
  }
  const tags = recipe.dietaryTags.map(normalize);
  return dietaryPreferences.every((pref) => tags.includes(normalize(pref)));
};

const matchesFilters = (recipe, filters) => {
  const { difficulty, maxTimeMinutes } = filters;
  if (difficulty && normalize(recipe.difficulty) !== normalize(difficulty)) {
    return false;
  }
  if (Number.isFinite(maxTimeMinutes) && recipe.timeMinutes > maxTimeMinutes) {
    return false;
  }
  return true;
};

const matchRecipes = () => {
  const manualIngredients = ingredientInput.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const availableIngredients = [
    ...new Set([...manualIngredients, ...recognizedIngredients])
  ].map(normalize);

  const dietaryPreferences = getDietaryPreferences();
  const filters = {
    difficulty: difficultySelect.value,
    maxTimeMinutes: timeInput.value ? Number(timeInput.value) : undefined
  };
  const targetServings = servingsInput.value ? Number(servingsInput.value) : undefined;

  if (!availableIngredients.length) {
    statusEl.textContent = "Please add ingredients to generate recipes.";
    return [];
  }

  statusEl.textContent = "Matching recipes...";

  const candidates = recipes
    .filter((recipe) => matchesDietary(recipe, dietaryPreferences))
    .filter((recipe) => matchesFilters(recipe, filters))
    .map((recipe) => ({
      ...recipe,
      matchScore: scoreRecipe(recipe, availableIngredients)
    }))
    .filter((recipe) => recipe.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((recipe) => adjustServings(recipe, targetServings));

  statusEl.textContent = `${candidates.length} recipes matched.`;
  return candidates;
};

const renderRecipeCard = (recipe, favorites, ratings) => {
  const tags = [recipe.cuisine, recipe.difficulty, `${recipe.timeMinutes} mins`]
    .filter(Boolean)
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("");

  const dietaryTags = recipe.dietaryTags
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("");

  const ingredients = recipe.ingredients
    .map((item) => `${item.quantity} ${item.unit} ${item.name}`)
    .join(", ");

  const steps = recipe.steps.map((step) => `<li>${step}</li>`).join("");

  const ratingValue = ratings[recipe.id] || 0;
  const ratingButtons = [1, 2, 3, 4, 5]
    .map(
      (value) =>
        `<button class="${ratingValue >= value ? "active" : ""}" data-rating="${value}">
          ${value}
        </button>`
    )
    .join("");

  return `
    <article class="recipe-card" data-id="${recipe.id}">
      <div>
        <h3>${recipe.name}</h3>
        <div class="recipe-meta">${tags}</div>
        <div class="tags">${dietaryTags}</div>
      </div>
      <p><strong>Match score:</strong> ${(recipe.matchScore * 100).toFixed(0)}%</p>
      <p><strong>Servings:</strong> ${recipe.servings}</p>
      <p><strong>Ingredients:</strong> ${ingredients}</p>
      <p><strong>Nutrition:</strong> ${recipe.nutrition.calories} kcal, ${
    recipe.nutrition.protein
  }g protein</p>
      <ol>${steps}</ol>
      <div class="actions">
        <button class="ghost favorite-btn">${
          favorites.has(recipe.id) ? "★ Favorited" : "☆ Favorite"
        }</button>
      </div>
      <div class="rating">${ratingButtons}</div>
    </article>
  `;
};

const renderRecipes = (results) => {
  const favorites = getStoredFavorites();
  const ratings = getStoredRatings();
  const filteredResults = favoritesToggle.checked
    ? results.filter((recipe) => favorites.has(recipe.id))
    : results;

  recipeList.innerHTML = filteredResults
    .map((recipe) => renderRecipeCard(recipe, favorites, ratings))
    .join("");

  recipeList.querySelectorAll(".favorite-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.target.closest(".recipe-card");
      const id = card.dataset.id;
      const nextFavorites = getStoredFavorites();
      if (nextFavorites.has(id)) {
        nextFavorites.delete(id);
      } else {
        nextFavorites.add(id);
      }
      storeFavorites(nextFavorites);
      renderRecipes(results);
      renderSuggestions();
    });
  });

  recipeList.querySelectorAll(".rating button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.target.closest(".recipe-card");
      const id = card.dataset.id;
      const rating = Number(event.target.dataset.rating);
      const ratings = getStoredRatings();
      ratings[id] = rating;
      storeRatings(ratings);
      renderRecipes(results);
      renderSuggestions();
    });
  });
};

const renderSuggestions = () => {
  const ratings = getStoredRatings();
  const sorted = [...recipes].sort(
    (a, b) => (ratings[b.id] || 0) - (ratings[a.id] || 0)
  );


  suggestionList.innerHTML = sorted
    .slice(0, 3)
    .map((recipe) =>
      `
        <article class="recipe-card">
          <h3>${recipe.name}</h3>
          <p>${recipe.cuisine} · ${recipe.timeMinutes} mins</p>
          <p>Rating: ${ratings[recipe.id] || 0}/5</p>
        </article>
      `.trim()
    )
    .join("");
};

const resolveIngredients = (predictions) => {
  const resolved = new Set();
  predictions.forEach((prediction) => {
    const label = prediction.label.toLowerCase();
    Object.entries(INGREDIENT_MAP).forEach(([key, ingredients]) => {
      if (label.includes(key)) {
        ingredients.forEach((ingredient) => resolved.add(ingredient));
      }
    });
    KNOWN_INGREDIENTS.forEach((ingredient) => {
      if (label.includes(ingredient)) {
        resolved.add(ingredient);
      }
    });
  });
  return Array.from(resolved);
};

const recognizeIngredientsFromImage = async (file) => {
  if (!file) {
    return [];
  }
  const reader = new FileReader();
  const base64Data = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

  const response = await fetch("/api/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64Data })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.error || "Recognition failed.");
  }

  const data = await response.json();
  return resolveIngredients(data.predictions || []);
};

imageInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  imageHint.textContent = "Analyzing image with AI...";
  try {
    recognizedIngredients = await recognizeIngredientsFromImage(file);
    if (!recognizedIngredients.length) {
      imageHint.textContent =
        "No ingredient match found. Try another image or add manually.";
    } else {
      imageHint.textContent = "Recognized ingredients appear below.";
    }
  } catch (error) {
    imageHint.textContent = error.message;
    recognizedIngredients = [];
  }
  renderRecognized();
});

matchButton.addEventListener("click", () => {
  const results = matchRecipes();
  renderRecipes(results);
});

favoritesToggle.addEventListener("change", () => {
  const results = matchRecipes();
  renderRecipes(results);
});

updateSubstitutions();
loadRecipes();

const rerunMatchIfPossible = () => {
  if (!recipes.length) return;
  const results = matchRecipes();
  renderRecipes(results);
};

// Re-run when dietary preferences change
document.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
  checkbox.addEventListener("change", rerunMatchIfPossible);
});

// Re-run when filters change
difficultySelect.addEventListener("change", rerunMatchIfPossible);
timeInput.addEventListener("input", rerunMatchIfPossible);
servingsInput.addEventListener("input", rerunMatchIfPossible);
