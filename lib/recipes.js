const fs = require("fs/promises");
const path = require("path");
const { getRecipesCollection } = require("./mongodb");

const DATA_PATH = path.join(__dirname, "..", "data", "recipes.json");

const readRecipesFromJson = async () => {
  const data = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(data);
};

const getRecipes = async () => {
  let collection;

  try {
    collection = await getRecipesCollection();
  } catch (error) {
    console.warn("MongoDB recipes unavailable, falling back to JSON:", error.message);
    return readRecipesFromJson();
  }

  if (!collection) {
    return readRecipesFromJson();
  }

  let recipes;

  try {
    recipes = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ id: 1 })
      .toArray();
  } catch (error) {
    console.warn("MongoDB recipes unavailable, falling back to JSON:", error.message);
    return readRecipesFromJson();
  }

  if (!recipes.length) {
    return readRecipesFromJson();
  }

  return recipes;
};

const seedRecipesFromJson = async () => {
  const collection = await getRecipesCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to seed recipes");
  }

  const recipes = await readRecipesFromJson();

  await collection.createIndex({ id: 1 }, { unique: true });

  if (!recipes.length) {
    return { matched: 0, upserted: 0, modified: 0 };
  }

  const result = await collection.bulkWrite(
    recipes.map((recipe) => ({
      replaceOne: {
        filter: { id: recipe.id },
        replacement: recipe,
        upsert: true
      }
    }))
  );

  return {
    matched: result.matchedCount,
    upserted: result.upsertedCount,
    modified: result.modifiedCount
  };
};

module.exports = {
  DATA_PATH,
  getRecipes,
  readRecipesFromJson,
  seedRecipesFromJson
};
