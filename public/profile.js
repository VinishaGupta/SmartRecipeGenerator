const RENDER_BACKEND_URL = "https://smartrecipegenerator-rbkj.onrender.com";
const CLOUDINARY_CLOUD_NAME = "djsenbil3";
const RECIPE_IMAGE_FOLDER = "";
const FAVORITES_KEY = "favoriteRecipes";
const FALLBACK_RECIPE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23f1f5f9'/%3E%3Cpath d='M184 244h272c18 0 28-20 18-35l-42-64c-9-14-28-15-38-2l-30 39-18-22c-10-13-30-12-39 2l-42 63-21-25c-10-12-29-10-36 4l-35 40c-7 14 3 30 21 30z' fill='%23cbd5e1'/%3E%3Ccircle cx='220' cy='118' r='34' fill='%23cbd5e1'/%3E%3C/svg%3E";

const profileRecipeGrid = document.getElementById("profileRecipeGrid");
const profileSearch = document.getElementById("profileSearch");
const profileResultSummary = document.getElementById("profileResultSummary");
const profileSectionTitle = document.getElementById("profileSectionTitle");
const profileGridView = document.getElementById("profileGridView");
const profileListView = document.getElementById("profileListView");
const profilePromptForm = document.getElementById("profilePromptForm");
const profilePromptInput = document.getElementById("profilePromptInput");
const profileBackBtn = document.getElementById("profileBackBtn");

let recipes = [];
let activeTab = "saved";
let compactView = false;

const getBackendBaseUrl = () => {
  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".onrender.com")) {
    return "";
  }

  return RENDER_BACKEND_URL;
};

const apiUrl = (path) => `${getBackendBaseUrl()}${path}`;

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const getCurrentUser = async () => {
  try {
    const response = await fetch(apiUrl("/api/auth/me"), { credentials: "same-origin" });
    if (!response.ok) return null;
    return await parseJsonSafely(response);
  } catch (error) {
    return null;
  }
};

const getFavorites = () =>
  JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]").map(String);

const setFavorites = (favorites) =>
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.map(String)));

const formatDisplayName = (value) => {
  const fallback = "Chef";
  const name = String(value || "").trim() || fallback;
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const getInitial = (value) =>
  (String(value || "C").trim().charAt(0) || "C").toUpperCase();

const getImageUrl = (imageName) => {
  if (!imageName) return FALLBACK_RECIPE_IMAGE;
  if (/^https?:\/\//i.test(imageName)) return imageName;

  const safePublicId = encodeURIComponent(imageName).replace(/%2F/g, "/");
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_720,h_560,c_fill,q_auto,f_auto/${RECIPE_IMAGE_FOLDER ? `${RECIPE_IMAGE_FOLDER}/` : ""}${safePublicId}`;
};

const getRecipeTags = (recipe) => {
  const tags = [`${recipe.timeMinutes ?? "N/A"} min`, recipe.difficulty || "Easy"];

  if ((recipe.nutrition?.protein || 0) >= 25) {
    tags.unshift("High Protein");
  }

  return tags.slice(0, 3);
};

const recipeDescription = (recipe) => {
  const ingredients = (recipe.ingredients || [])
    .map(ingredient => ingredient.name)
    .slice(0, 3)
    .join(", ");

  return `${recipe.cuisine || "Chef-inspired"} cooking with ${ingredients || "smart pantry staples"}.`;
};

const currentRecipes = () => {
  if (activeTab !== "saved") {
    return [];
  }

  const favoriteIds = new Set(getFavorites());
  const savedRecipes = recipes.filter(recipe => favoriteIds.has(String(recipe.id)));
  const source = savedRecipes.length ? savedRecipes : recipes.slice(0, 6);
  const query = profileSearch.value.trim().toLowerCase();

  return source.filter(recipe => {
    if (!query) return true;
    return [
      recipe.name,
      recipe.cuisine,
      recipe.difficulty,
      ...(recipe.dietaryTags || []),
      ...(recipe.ingredients || []).map(ingredient => ingredient.name)
    ].join(" ").toLowerCase().includes(query);
  });
};

const updateStats = () => {
  const favoriteIds = new Set(getFavorites());
  const savedRecipes = recipes.filter(recipe => favoriteIds.has(String(recipe.id)));
  const visibleSaved = savedRecipes.length ? savedRecipes : recipes.slice(0, 6);

  document.getElementById("savedCount").textContent = String(visibleSaved.length);
  document.getElementById("proteinCount").textContent = String(
    visibleSaved.filter(recipe => (recipe.nutrition?.protein || 0) >= 25).length
  );
  document.getElementById("cookedCount").textContent = String(
    Math.max(visibleSaved.length * 2, savedRecipes.length)
  );
};

const renderRecipes = () => {
  const displayedRecipes = currentRecipes();
  const favorites = new Set(getFavorites());

  profileRecipeGrid.classList.toggle("compact", compactView);
  profileResultSummary.textContent = activeTab === "saved"
    ? displayedRecipes.length
      ? `${displayedRecipes.length} recipes shown`
      : "No recipes match your search"
    : "Coming soon";

  if (!displayedRecipes.length) {
    profileRecipeGrid.innerHTML = activeTab === "saved"
      ? "<p class=\"empty-state\">No recipes found.</p>"
      : "<p class=\"empty-state\">This section will be available soon.</p>";
    return;
  }

  profileRecipeGrid.innerHTML = displayedRecipes.map((recipe, index) => {
    const isSaved = favorites.has(String(recipe.id));

    return `
      <article class="profile-recipe-card" data-recipe-url="recipe.html?id=${encodeURIComponent(recipe.id)}">
        <div class="profile-card-image">
          <img src="${getImageUrl(recipe.image)}" alt="${recipe.name}" loading="lazy" />
          <button class="profile-favorite ${isSaved ? "active" : ""}" type="button" data-id="${recipe.id}" title="${isSaved ? "Remove from saved" : "Save recipe"}">
            <i data-lucide="heart"></i>
          </button>
          <div class="profile-card-tags">
            ${getRecipeTags(recipe).map(tag => `<span>${tag}</span>`).join("")}
          </div>
        </div>
        <div class="profile-card-body">
          <h3>${recipe.name}</h3>
          <p>${recipeDescription(recipe)}</p>
          <div class="profile-card-foot">
            <span>${recipe.servings ?? 2} servings</span>
            <a href="recipe.html?id=${encodeURIComponent(recipe.id)}">Cook This Now</a>
          </div>
        </div>
      </article>
    `;
  }).join("");

  profileRecipeGrid.querySelectorAll(".profile-card-image img").forEach(image => {
    image.addEventListener("error", () => {
      image.src = FALLBACK_RECIPE_IMAGE;
    }, { once: true });
  });

  profileRecipeGrid.querySelectorAll(".profile-recipe-card").forEach(card => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      window.location.href = card.dataset.recipeUrl;
    });
  });

  profileRecipeGrid.querySelectorAll(".profile-favorite").forEach(button => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const recipeId = String(button.dataset.id);
      const favoritesList = getFavorites();
      const nextFavorites = favoritesList.includes(recipeId)
        ? favoritesList.filter(id => id !== recipeId)
        : [...favoritesList, recipeId];

      setFavorites(nextFavorites);
      updateStats();
      renderRecipes();
    });
  });

  lucide.createIcons();
};

const setUserDetails = async () => {
  const user = await getCurrentUser();
  const displayName = formatDisplayName(user?.displayName || user?.email?.split("@")[0]);
  const initial = getInitial(displayName);

  document.getElementById("profileName").textContent = displayName;
  document.getElementById("profileMiniName").textContent = displayName;
  document.getElementById("profileAvatar").textContent = initial;
  document.getElementById("profileMiniAvatar").textContent = initial;
  document.getElementById("sousChefTitle").textContent = `What's in your kitchen tonight, ${displayName}?`;
};

const loadRecipes = async () => {
  try {
    const response = await fetch(apiUrl("/api/recipes"));
    if (!response.ok) throw new Error("Recipes could not be loaded");
    recipes = await response.json();
    updateStats();
    renderRecipes();
  } catch (error) {
    console.error(error);
    profileResultSummary.textContent = "Could not load recipes";
    profileRecipeGrid.innerHTML = "<p class=\"empty-state\">Could not load recipes.</p>";
  }
};

document.querySelectorAll("[data-profile-tab]").forEach(button => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.profileTab;
    document.querySelectorAll("[data-profile-tab]").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });
    profileSectionTitle.textContent = activeTab === "saved"
      ? "Recently Saved"
      : activeTab === "creations"
        ? "My Creations"
        : "Meal Plans";
    renderRecipes();
  });
});

document.querySelectorAll(".profile-nav button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".profile-nav button").forEach(navButton => {
      navButton.classList.toggle("active", navButton === button);
    });
  });
});

profileSearch.addEventListener("input", renderRecipes);

profileGridView.addEventListener("click", () => {
  compactView = false;
  profileGridView.classList.add("active");
  profileListView.classList.remove("active");
  renderRecipes();
});

profileListView.addEventListener("click", () => {
  compactView = true;
  profileListView.classList.add("active");
  profileGridView.classList.remove("active");
  renderRecipes();
});

profilePromptForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = profilePromptInput.value.trim();
  window.location.href = prompt
    ? `index.html?ingredients=${encodeURIComponent(prompt)}`
    : "index.html";
});

profileBackBtn.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = "index.html";
});

setUserDetails();
loadRecipes();
