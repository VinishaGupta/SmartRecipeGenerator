const {
  matchRecipes,
  getSubstitutions,
  rateRecipe,
  saveFavorite,
  suggestRecipesByRatings,
  getRatingsSnapshot,
  loadRecipes
} = require("./recipeEngine");
const { recognizeIngredientsFromImage } = require("./ingredientRecognizer");

const demo = () => {
  const ingredients = ["tomato", "basil", "garlic", "pasta", "olive oil"];
  const dietaryPreferences = ["vegetarian"]; 
  const filters = { difficulty: "easy", maxTimeMinutes: 30 };

  const recipes = matchRecipes({
    ingredients,
    dietaryPreferences,
    filters,
    targetServings: 4
  });

  console.log("Top recipe matches:\n");
  recipes.slice(0, 3).forEach((recipe, index) => {
    console.log(`${index + 1}. ${recipe.name} (score ${recipe.matchScore.toFixed(2)})`);
  });

  if (recipes[0]) {
    console.log("\nSubstitution ideas for milk:", getSubstitutions("milk").join(", "));
    rateRecipe(recipes[0].id, 5);
    saveFavorite(recipes[0].id);
  }

  const suggestions = suggestRecipesByRatings(loadRecipes(), getRatingsSnapshot());
  console.log("\nSuggested by ratings:");
  console.log(suggestions[0]?.name || "No suggestions yet");

  const recognized = recognizeIngredientsFromImage("/images/tomato_basil.jpg");
  console.log("\nRecognized ingredients:", recognized.join(", "));
};

if (process.argv.includes("--lint")) {
  process.exit(0);
}

demo();
