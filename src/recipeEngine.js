const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "recipes.json");

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

const loadRecipes = async () => {
  try {
    const res = await fetch("/api/recipes");
    console.log("Reading recipes from:", DATA_PATH);

    recipes = await res.json();
    renderSuggestions();
  } catch (err) {
    console.error(err);
  }
};


const normalize = (value) => value.trim().toLowerCase();

const normalizeIngredients = (ingredients) =>
  ingredients.map((ingredient) => normalize(ingredient));

const matchesDietary = (recipe, dietaryPreferences = []) => {
  if (!dietaryPreferences.length) {
    return true;
  }
  const tags = recipe.dietaryTags.map(normalize);
  return dietaryPreferences.every((pref) => tags.includes(normalize(pref)));
};

const matchesFilters = (recipe, filters = {}) => {
  const { difficulty, maxTimeMinutes, dietaryRestrictions } = filters;
  if (difficulty && normalize(recipe.difficulty) !== normalize(difficulty)) {
    return false;
  }
  if (Number.isFinite(maxTimeMinutes) && recipe.timeMinutes > maxTimeMinutes) {
    return false;
  }
  if (dietaryRestrictions?.length && !matchesDietary(recipe, dietaryRestrictions)) {
    return false;
  }
  return true;
};

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

const getSubstitutions = (ingredient) => {
  const key = normalize(ingredient);
  return DEFAULT_SUBSTITUTIONS[key] || [];
};

const suggestRecipesByRatings = (recipes, ratings = {}) => {
  return recipes
    .map((recipe) => ({
      ...recipe,
      ratingScore: ratings[recipe.id] || 0
    }))
    .sort((a, b) => b.ratingScore - a.ratingScore);
};

const matchRecipes = ({
  ingredients = [],
  dietaryPreferences = [],
  filters = {},
  targetServings
}) => {
  const availableIngredients = normalizeIngredients(ingredients);
  const recipes = loadRecipes();
  const candidates = recipes
    .filter((recipe) => matchesDietary(recipe, dietaryPreferences))
    .filter((recipe) => matchesFilters(recipe, filters))
    .map((recipe) => ({
      ...recipe,
      matchScore: scoreRecipe(recipe, availableIngredients)
    }))
.filter((recipe) => recipe.matchScore >= 0)    .sort((a, b) => b.matchScore - a.matchScore);

  return candidates.map((recipe) => adjustServings(recipe, targetServings));
};

const ratingStore = new Map();
const favoritesStore = new Set();

const rateRecipe = (recipeId, rating) => {
  const normalizedRating = Math.max(1, Math.min(5, rating));
  ratingStore.set(recipeId, normalizedRating);
  return normalizedRating;
};

const saveFavorite = (recipeId) => {
  favoritesStore.add(recipeId);
  return Array.from(favoritesStore);
};

const getRatingsSnapshot = () => Object.fromEntries(ratingStore.entries());

module.exports = {
  loadRecipes,
  matchRecipes,
  adjustServings,
  getSubstitutions,
  suggestRecipesByRatings,
  rateRecipe,
  saveFavorite,
  getRatingsSnapshot
};
