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
const CLOUDINARY_CLOUD_NAME = "djsenbil3";
const RECIPE_IMAGE_FOLDER = "recipe-images";
const FALLBACK_RECIPE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23f1f5f9'/%3E%3Cpath d='M184 244h272c18 0 28-20 18-35l-42-64c-9-14-28-15-38-2l-30 39-18-22c-10-13-30-12-39 2l-42 63-21-25c-10-12-29-10-36 4l-35 40c-7 14 3 30 21 30z' fill='%23cbd5e1'/%3E%3Ccircle cx='220' cy='118' r='34' fill='%23cbd5e1'/%3E%3C/svg%3E";

const getImageUrl = (imageName) =>
  imageName
    ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${RECIPE_IMAGE_FOLDER}/${imageName}`
    : FALLBACK_RECIPE_IMAGE;

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

    <img
      class="recipe-detail-image"
      src="${getImageUrl(recipe.image)}"
      alt="${recipe.name}"
      loading="lazy"
    />

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
    recipeDetail.querySelector(".recipe-detail-image").addEventListener("error", (event) => {
      event.currentTarget.src = FALLBACK_RECIPE_IMAGE;
    }, { once: true });
    lucide.createIcons();
  } catch (error) {
    console.error(error);
    recipeDetail.innerHTML = "<p class=\"helper\">Could not load recipe.</p>";
  }
};

loadRecipe();
