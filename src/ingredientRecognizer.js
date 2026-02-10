const path = require("path");



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
