/*************************************************
 * BACKEND
 *************************************************/
const RENDER_BACKEND_URL = "https://smartrecipegenerator-rbkj.onrender.com";
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;
const CLOUDINARY_CLOUD_NAME = "djsenbil3";
const RECIPE_IMAGE_FOLDER = "";
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
const recipeList = document.getElementById("recipeList");
const resultSummary = document.getElementById("resultSummary");
const favoritesToggle = document.getElementById("favoritesToggle");
const authBtn = document.getElementById("authBtn");

const parseJsonSafely = async (res) => {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
};

const getCurrentUser = async () => {
  try {
    const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'same-origin' });
    if (!res.ok) return null;
    return await parseJsonSafely(res);
  } catch (err) {
    return null;
  }
};

const initAuthUI = async () => {
  if (!authBtn) return;
  const user = await getCurrentUser();

  if (user && user.email) {
    authBtn.textContent = user.displayName || user.email.split('@')[0] || 'Account';
    authBtn.href = '/api/auth/logout';
    authBtn.title = 'Sign out';
  } else {
    authBtn.textContent = 'Sign in';
    authBtn.href = '/api/auth/google';
    authBtn.title = 'Sign in';
  }
};

/*************************************************
 * STATE
 *************************************************/
let recipes = [];

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

const getRating = (recipeId) => Number(getRatings()[recipeId] || 0);

const normalize = (str) =>
  String(str || "").toLowerCase().trim();

/*************************************************
 * RECIPE UTILITIES
 *************************************************/
const recipeImageMarkup = (r) => {
  const cloudinaryUrl = (imageName) => {
    if (!imageName) return FALLBACK_RECIPE_IMAGE;
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_300,h_300,c_fill,q_auto,f_auto/${RECIPE_IMAGE_FOLDER ? `${RECIPE_IMAGE_FOLDER}/` : ""}${imageName}`;
  };

  return `<img class="recipe-card-image" src="${cloudinaryUrl(r.image)}" alt="${r.name}" onerror="this.src='${FALLBACK_RECIPE_IMAGE}'">`;
};

const getRecipeTags = (recipe) => {
  const tags = [...(recipe.dietaryTags || [])];

  if ((recipe.nutrition?.protein || 0) >= 25) {
    tags.unshift("High Protein");
  }

  return tags.slice(0, 2);
};

const getRecipeUrl = (recipe) => {
  return `recipe.html?id=${recipe.id}`;
};

/*************************************************
 * RECIPES DISPLAY
 *************************************************/
const attachFavoriteHandlers = () => {
  document.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const recipeId = btn.dataset.id;
      const favs = getFavorites();
      const idx = favs.indexOf(recipeId);

      if (idx > -1) {
        favs.splice(idx, 1);
      } else {
        favs.push(recipeId);
      }

      setFavorites(favs);
      btn.classList.toggle("active");
      renderRecipes(getDisplayedRecipes());
    });
  });
};

const attachRatingHandlers = () => {
  document.querySelectorAll(".rating").forEach(ratingDiv => {
    const recipeId = ratingDiv.dataset.id;

    ratingDiv.querySelectorAll(".star").forEach(star => {
      star.addEventListener("click", () => {
        const starValue = Number(star.dataset.star);
        const ratings = getRatings();
        ratings[recipeId] = starValue;
        setRatings(ratings);

        ratingDiv.querySelectorAll(".star").forEach(s => {
          if (Number(s.dataset.star) <= starValue) {
            s.classList.add("filled");
          } else {
            s.classList.remove("filled");
          }
        });
      });
    });
  });
};

const attachRecipeImageFallbacks = (container) => {
  container.querySelectorAll(".recipe-card-image").forEach(img => {
    img.addEventListener("error", () => {
      img.src = FALLBACK_RECIPE_IMAGE;
    });
  });
};

const getDisplayedRecipes = () => {
  const favoritesOnly = favoritesToggle?.checked || false;
  const favoriteIds = new Set(getFavorites().map(String));

  return recipes.filter(r => {
    if (!favoritesOnly) return true;
    return favoriteIds.has(String(r.id));
  });
};

const renderRecipes = (results) => {
  if (!recipeList) {
    console.warn("Recipe list element not found");
    return;
  }

  const favorites = getFavorites();
  const ratings = getRatings();

  if (!results.length) {
    recipeList.innerHTML = "<p class=\"empty-state\">No recipes found.</p>";
    if (resultSummary) resultSummary.textContent = "0 recipes found";
    return;
  }

  if (resultSummary) {
    resultSummary.textContent = `${results.length} recipes found`;
  }

  recipeList.innerHTML = results.map(r => {
    const isFav = favorites.includes(r.id);
    const rating = ratings[r.id] || 0;
    const displayRating = rating || "4.8";

    return `
      <article
        class="recipe-card"
        data-recipe-url="${getRecipeUrl(r)}"
        role="link"
        tabindex="0"
        style="cursor:pointer;"
      >
        <div class="recipe-image-wrap">
          ${recipeImageMarkup(r)}
          <div class="recipe-badges">
            ${getRecipeTags(r).map(tag => `<span class="tag">${tag}</span>`).join("")}
          </div>
          <button
            class="fav-btn ${isFav ? "active" : ""}"
            data-id="${r.id}"
            title="Toggle favorite"
          >
            <i data-lucide="heart"></i>
          </button>
        </div>

        <div class="recipe-card-body">
          <div class="recipe-title-row">
            <h3>${r.name}</h3>
            <div class="rating-score">
              <i data-lucide="star"></i>
              <span>${displayRating}</span>
            </div>
          </div>

          <p class="recipe-cuisine">${r.cuisine || "N/A"}</p>

          <div class="recipe-meta">
            <span>
              <i data-lucide="clock"></i>
              ${r.timeMinutes} mins
            </span>
            <span>
              <i data-lucide="users"></i>
              ${r.servings} servings
            </span>
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
        </div>
      </article>
    `;
  }).join("");

  attachFavoriteHandlers();
  attachRatingHandlers();
  attachRecipeImageFallbacks(recipeList);
  recipeList.querySelectorAll(".recipe-link").forEach(link => {
    link.addEventListener("click", (e) => {
      // Allow default navigation
    });
  });
  recipeList.querySelectorAll(".recipe-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".fav-btn")) {
        const url = card.dataset.recipeUrl;
        if (url) window.location.href = url;
      }
    });
  });
  lucide.createIcons();
};

const loadRecipes = async () => {
  try {
    const res = await fetch(apiUrl("/api/recipes"));
    recipes = await res.json();
    renderRecipes(getDisplayedRecipes());
  } catch (err) {
    console.error("Error loading recipes:", err);
    resultSummary.textContent = "Error loading recipes";
  }
};

/*************************************************
 * EVENT LISTENERS
 *************************************************/
if (favoritesToggle) {
  favoritesToggle.addEventListener("change", () => {
    renderRecipes(getDisplayedRecipes());
  });
}

/*************************************************
 * INIT
 *************************************************/
startBackendAutoPing();
initAuthUI();
loadRecipes();
