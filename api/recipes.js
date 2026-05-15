const { getRecipes } = require("../lib/recipes");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const recipes = await getRecipes();
    res.status(200).json(recipes);
  } catch (error) {
    console.error("Failed to load recipes:", error);
    res.status(500).json({ error: "Failed to load recipes" });
  }
};
