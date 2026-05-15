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
const RECIPE_IMAGE_FOLDER = "";
const FALLBACK_RECIPE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23f1f5f9'/%3E%3Cpath d='M184 244h272c18 0 28-20 18-35l-42-64c-9-14-28-15-38-2l-30 39-18-22c-10-13-30-12-39 2l-42 63-21-25c-10-12-29-10-36 4l-35 40c-7 14 3 30 21 30z' fill='%23cbd5e1'/%3E%3Ccircle cx='220' cy='118' r='34' fill='%23cbd5e1'/%3E%3C/svg%3E";

const getImageUrl = (imageName) =>
  imageName
    ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${RECIPE_IMAGE_FOLDER ? `${RECIPE_IMAGE_FOLDER}/` : ""}${imageName}`
    : FALLBACK_RECIPE_IMAGE;

const getRecipeTags = (recipe) => {
  const tags = [...(recipe.dietaryTags || [])];

  if ((recipe.nutrition?.protein || 0) >= 25) {
    tags.unshift("High Protein");
  }

  tags.push(`${recipe.timeMinutes ?? "N/A"} Mins`);
  tags.push(`${recipe.nutrition?.calories ?? 0} kcal`);

  return tags.slice(0, 3);
};

const formatIngredient = (ingredient) =>
  [ingredient.quantity, ingredient.unit, ingredient.name]
    .filter(value => value !== undefined && value !== null && value !== "")
    .join(" ");

const renderRecipe = (recipe) => {
  const nutrition = recipe.nutrition || {};

  recipeDetail.innerHTML = `
    <div class="recipe-split">
      <div class="recipe-media-pane">
        <img
          class="recipe-detail-image"
          src="${getImageUrl(recipe.image)}"
          alt="${recipe.name}"
          loading="lazy"
        />
      </div>

      <article class="recipe-content-pane">
        <div class="detail-tags">
          ${getRecipeTags(recipe).map(tag => `<span class="detail-tag">${tag}</span>`).join("")}
        </div>

        <h1>${recipe.name}</h1>
        <p class="detail-description">
          A vibrant ${recipe.cuisine || "chef-inspired"} recipe built around simple ingredients,
          balanced nutrition, and weeknight-friendly cooking.
        </p>

        <p class="detail-eyebrow">Nutritional Overview</p>
        <dl class="nutrition-list">
          <div><dt>Calories</dt><dd>${nutrition.calories ?? 0}</dd></div>
          <div><dt>Protein</dt><dd>${nutrition.protein ?? 0}g</dd></div>
          <div><dt>Net Carbs</dt><dd>${nutrition.carbs ?? 0}g</dd></div>
          <div><dt>Fat</dt><dd>${nutrition.fat ?? 0}g</dd></div>
        </dl>

        <div class="ingredients-heading">
          <h2>Ingredients</h2>
          <span>Yields: ${recipe.servings ?? "N/A"} Servings</span>
        </div>
        <ul class="ingredient-list">
          ${(recipe.ingredients || []).map(ingredient => `
            <li><span></span>${formatIngredient(ingredient)}</li>
          `).join("")}
        </ul>

        <section class="steps-panel">
          <h2>Steps</h2>
          <ol class="step-list">
            ${(recipe.steps || []).map(step => `<li>${step}</li>`).join("")}
          </ol>
        </section>
      </article>
    </div>

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
