/***********************
 * INGREDIENT DATA
 ***********************/
const KNOWN_INGREDIENTS = [
  // Vegetables
  "tomato","onion","garlic","ginger","spinach","lettuce","kale","cabbage",
  "broccoli","cauliflower","carrot","bell pepper","zucchini","cucumber",
  "eggplant","peas","corn","mushroom","asparagus","celery","sweet potato","potato",

  // Fruits
  "apple","banana","lemon","lime","orange","avocado","berries","strawberry",
  "blueberry","grapes","pineapple","mango",

  // Proteins
  "chicken","beef","pork","turkey","fish","salmon","tuna","shrimp","egg",
  "tofu","tempeh","lentils","chickpeas","beans","black beans",

  // Grains
  "rice","brown rice","quinoa","pasta","noodles","bread","tortilla","oats",

  // Dairy
  "milk","cheese","mozzarella","parmesan","butter","yogurt","greek yogurt",
  "cream","coconut milk",

  // Herbs & spices
  "basil","cilantro","parsley","mint","oregano","thyme","rosemary",
  "pepper","salt","paprika","cumin","curry","chili powder",

  // Common dishes
  "salad","soup","stir fry","ramen","sandwich","burger","pizza","taco"
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
  beef: ["mushrooms","lentils"]
};

/***********************
 * DOM ELEMENTS
 ***********************/
const ingredientInput = document.getElementById("ingredientInput");
const imageInput = document.getElementById("imageInput");
const ingredientSelector = document.getElementById("ingredientSelector");
const recognizedPills = document.getElementById("recognizedPills");
const matchButton = document.getElementById("matchButton");
const statusEl = document.getElementById("status");
const recipeList = document.getElementById("recipeList");
const suggestionList = document.getElementById("suggestionList");
const substitutionList = document.getElementById("substitutionList");
const difficultySelect = document.getElementById("difficultySelect");
const timeInput = document.getElementById("timeInput");
const servingsInput = document.getElementById("servingsInput");
const favoritesToggle = document.getElementById("favoritesToggle");

/***********************
 * STATE
 ***********************/
let recipes = [];
let recognizedIngredients = [];

/***********************
 * HELPERS
 ***********************/
const normalize = (v) => v.trim().toLowerCase();

const getDietaryPreferences = () =>
  Array.from(document.querySelectorAll(".dietary-checkbox:checked"))
    .map((i) => i.value);

/***********************
 * INGREDIENT UI SYNC
 ***********************/
const renderRecognized = () => {
  const pills = ingredientInput.value
    .split(",")
    .map(normalize)
    .filter(Boolean);

  recognizedPills.innerHTML = pills
    .map((i) => `<span class="pill">${i}</span>`)
    .join("");
};

const syncSelectedIngredients = () => {
  const selected = Array.from(
    document.querySelectorAll(".ingredient-checkbox:checked")
  ).map((cb) => cb.value);

  const manual = ingredientInput.value
    .split(",")
    .map(normalize)
    .filter(Boolean);

  const merged = Array.from(new Set([...manual, ...selected, ...recognizedIngredients]));
  ingredientInput.value = merged.join(", ");
  renderRecognized();
};

/***********************
 * INGREDIENT SELECTOR
 ***********************/
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

  // accordion behavior
  document.querySelectorAll(".dropdown-header").forEach(header => {
    header.addEventListener("click", () => {
      const current = header.parentElement;

      document.querySelectorAll(".dropdown.open").forEach(d => {
        if (d !== current) d.classList.remove("open");
      });

      current.classList.toggle("open");
    });
  });

  // checkbox → ingredient input
  document.querySelectorAll(".ingredient-checkbox").forEach(cb => {
    cb.addEventListener("change", () => {
      syncSelectedIngredients();
      rerunMatchIfPossible();
    });
  });
};

/***********************
 * SUBSTITUTIONS
 ***********************/
const updateSubstitutions = () => {
  substitutionList.innerHTML = Object.entries(DEFAULT_SUBSTITUTIONS)
    .map(([k,v]) => `<li><strong>${k}:</strong> ${v.join(", ")}</li>`)
    .join("");
};

/***********************
 * RECIPES
 ***********************/
const loadRecipes = async () => {
  const res = await fetch("/api/recipes");
  recipes = await res.json();
  renderSuggestions();
};

const scoreRecipe = (recipe, available) => {
  const items = recipe.ingredients.map(i => normalize(i.name));
  const match = items.filter(i => available.includes(i));
  return match.length / items.length;
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

  const prefs = getDietaryPreferences();

  const results = recipes
    .filter(r => !prefs.length || prefs.every(p => r.dietaryTags.includes(p)))
    .filter(r => !difficultySelect.value || r.difficulty.toLowerCase() === difficultySelect.value.toLowerCase())
    .filter(r => !timeInput.value || r.timeMinutes <= Number(timeInput.value))
    .map(r => ({ ...r, matchScore: scoreRecipe(r, available) }))
    .filter(r => r.matchScore > 0)
    .sort((a,b) => b.matchScore - a.matchScore);

  statusEl.textContent = `${results.length} recipes matched.`;
  return results;
};

const renderRecipes = (results) => {
  recipeList.innerHTML = results.map(r => `
    <article class="recipe-card">
      <h3>${r.name}</h3>
      <p>Match score: ${(r.matchScore * 100).toFixed(0)}%</p>
    </article>
  `).join("");
};

const renderSuggestions = () => {
  suggestionList.innerHTML = recipes.slice(0,3)
    .map(r => `<div class="recipe-card"><h3>${r.name}</h3></div>`)
    .join("");
};

/***********************
 * EVENTS
 ***********************/
matchButton.addEventListener("click", () => {
  renderRecipes(matchRecipes());
});

const rerunMatchIfPossible = () => {
  if (!recipes.length) return;
  renderRecipes(matchRecipes());
};

difficultySelect.addEventListener("change", rerunMatchIfPossible);
timeInput.addEventListener("input", rerunMatchIfPossible);
servingsInput.addEventListener("input", rerunMatchIfPossible);

/***********************
 * INIT
 ***********************/
updateSubstitutions();
renderIngredientSelector();
loadRecipes();
