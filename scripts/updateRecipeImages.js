require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { getMongoConfig } = require("../lib/mongodb");
const { createRecipeModel } = require("../models/Recipe");

const MAPPINGS_PATH = path.join(__dirname, "recipeImageMappings.json");

const normalizeMappings = (rawMappings) => {
  if (Array.isArray(rawMappings)) {
    return rawMappings.map(({ id, image }) => ({ id, image }));
  }

  return Object.entries(rawMappings).map(([id, image]) => ({ id, image }));
};

const isValidMapping = ({ id, image }) =>
  typeof id === "string" &&
  id.trim() !== "" &&
  typeof image === "string" &&
  image.trim() !== "";

const loadMappings = async () => {
  const content = await fs.readFile(MAPPINGS_PATH, "utf-8");
  const mappings = normalizeMappings(JSON.parse(content))
    .map(({ id, image }) => ({
      id: id.trim(),
      image: image.trim()
    }));

  const invalidMappings = mappings.filter(mapping => !isValidMapping(mapping));

  if (invalidMappings.length) {
    throw new Error(`${invalidMappings.length} image mapping(s) are missing an id or image filename`);
  }

  if (!mappings.length) {
    throw new Error(`No image mappings found in ${MAPPINGS_PATH}`);
  }

  return mappings;
};

const updateRecipeImages = async () => {
  const { uri, dbName, collectionName } = getMongoConfig();

  if (!uri) {
    throw new Error("MONGODB_URI is required to update recipe images");
  }

  const mappings = await loadMappings();

  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000
  });

  const Recipe = createRecipeModel(mongoose.connection, collectionName);
  const result = await Recipe.bulkWrite(
    mappings.map(({ id, image }) => ({
      updateOne: {
        filter: { id },
        update: { $set: { image } },
        upsert: false
      }
    })),
    { ordered: false }
  );

  const matchedIds = new Set(
    (await Recipe.find(
      { id: { $in: mappings.map(mapping => mapping.id) } },
      { _id: 0, id: 1 }
    ).lean()).map(recipe => recipe.id)
  );
  const missingIds = mappings
    .map(mapping => mapping.id)
    .filter(id => !matchedIds.has(id));

  console.log(`Updated recipe images in ${dbName}.${collectionName}`);
  console.log(`Mappings processed: ${mappings.length}`);
  console.log(`Matched recipes: ${result.matchedCount}`);
  console.log(`Modified recipes: ${result.modifiedCount}`);
  console.log(`Missing recipe IDs: ${missingIds.length ? missingIds.join(", ") : "none"}`);
};

updateRecipeImages()
  .catch((error) => {
    console.error("Recipe image update failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
