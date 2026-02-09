const path = require("path");

const KNOWN_INGREDIENTS = [
  "tomato",
  "basil",
  "garlic",
  "onion",
  "spinach",
  "chicken",
  "tofu",
  "bell pepper",
  "avocado",
  "salmon",
  "shrimp",
  "egg",
  "mushroom",
  "beef",
  "zucchini"
];

const recognizeIngredientsFromImage = (imagePath) => {
  const filename = path.basename(imagePath).toLowerCase();
  const matches = KNOWN_INGREDIENTS.filter((ingredient) =>
    filename.includes(ingredient.replace(" ", ""))
  );
  return matches.length ? matches : ["tomato", "onion"];
};

module.exports = {
  recognizeIngredientsFromImage
};
