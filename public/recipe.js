const RENDER_BACKEND_URL = "https://smartrecipegenerator-rbkj.onrender.com";

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

const apiUrl = (path) => `${getBackendBaseUrl()}${path}`;
const recipeDetail = document.getElementById("recipeDetail");

const formatIngredient = (ingredient) =>
  [ingredient.quantity, ingredient.unit, ingredient.name]
    .filter(value => value !== undefined && value !== null && value !== "")
    .join(" ");

const renderRecipe = (recipe) => {
  const nutrition = recipe.nutrition || {};

  recipeDetail.innerHTML = `
    <header class="recipe-detail-hero">
      <div>
        <p class="eyebrow">${recipe.cuisine || "Recipe"}</p>
        <h1>${recipe.name}</h1>
        <div class="recipe-detail-meta">
          <span><strong>Difficulty:</strong> ${recipe.difficulty || "N/A"}</span>
          <span><strong>Time:</strong> ${recipe.timeMinutes ?? "N/A"} mins</span>
          <span><strong>Servings:</strong> ${recipe.servings ?? "N/A"}</span>
        </div>
      </div>
      <div class="tags">
        ${(recipe.dietaryTags || []).map(tag => `<span class="tag">${tag}</span>`).join("")}
      </div>
    </header>

    <div class="recipe-detail-grid">
      <section class="recipe-panel">
        <h2>Ingredients</h2>
        <ul class="ingredient-list">
          ${(recipe.ingredients || []).map(ingredient => `
            <li>${formatIngredient(ingredient)}</li>
          `).join("")}
        </ul>
      </section>

      <section class="recipe-panel">
        <h2>Nutrition</h2>
        <dl class="nutrition-list">
          <div><dt>Calories</dt><dd>${nutrition.calories ?? 0}</dd></div>
          <div><dt>Protein</dt><dd>${nutrition.protein ?? 0} g</dd></div>
          <div><dt>Carbs</dt><dd>${nutrition.carbs ?? 0} g</dd></div>
          <div><dt>Fat</dt><dd>${nutrition.fat ?? 0} g</dd></div>
        </dl>
      </section>
    </div>

    <section class="recipe-panel">
      <h2>Steps</h2>
      <ol class="step-list">
        ${(recipe.steps || []).map(step => `<li>${step}</li>`).join("")}
      </ol>
    </section>
  `;
};

const loadRecipe = async () => {
  const recipeId = new URLSearchParams(window.location.search).get("id");

  if (!recipeId) {
    recipeDetail.innerHTML = "<p class=\"helper\">Recipe not found.</p>";
    return;
  }

  try {
    const response = await fetch(apiUrl("/api/recipes"));

    if (!response.ok) {
      throw new Error("Recipes could not be loaded");
    }

    const recipes = await response.json();
    const recipe = recipes.find(item => item.id === recipeId);

    if (!recipe) {
      recipeDetail.innerHTML = "<p class=\"helper\">Recipe not found.</p>";
      return;
    }

    renderRecipe(recipe);
    lucide.createIcons();
  } catch (error) {
    console.error(error);
    recipeDetail.innerHTML = "<p class=\"helper\">Could not load recipe.</p>";
  }
};

loadRecipe();
