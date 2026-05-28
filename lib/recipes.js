const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { getRecipesCollection, getRecipeSubmissionsCollection } = require("./mongodb");

const DATA_PATH = path.join(__dirname, "..", "data", "recipes.json");

const readRecipesFromJson = async () => {
  const data = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(data).filter((recipe) => recipe.status !== "pending" && recipe.status !== "rejected");
};

const slugifyRecipeId = (value) =>
  String(value || "recipe")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "recipe";

const createRecipeId = (name) => `recipe-${slugifyRecipeId(name)}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

const normalizeRecipeArray = (value) => Array.isArray(value) ? value : [];

const normalizeRecipeSubmission = (payload = {}) => {
  const name = String(payload.name || payload.title || "").trim();

  if (!name) {
    throw new Error("Recipe name is required");
  }

  const ingredients = normalizeRecipeArray(payload.ingredients)
    .map((ingredient) => ({
      quantity: ingredient?.quantity === undefined || ingredient?.quantity === null || ingredient?.quantity === ""
        ? ""
        : String(ingredient.quantity).trim(),
      unit: String(ingredient?.unit || "").trim(),
      name: String(ingredient?.name || ingredient?.ingredient || "").trim()
    }))
    .filter((ingredient) => ingredient.name);

  const steps = normalizeRecipeArray(payload.steps)
    .map((step) => String(step || "").trim())
    .filter(Boolean);

  if (!ingredients.length) {
    throw new Error("At least one ingredient is required");
  }

  if (!steps.length) {
    throw new Error("At least one preparation step is required");
  }

  const numericValue = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const nutrition = payload.nutrition && typeof payload.nutrition === "object"
    ? {
        calories: numericValue(payload.nutrition.calories, 0),
        protein: numericValue(payload.nutrition.protein, 0),
        carbs: numericValue(payload.nutrition.carbs, 0),
        fat: numericValue(payload.nutrition.fat, 0)
      }
    : {};

  return {
    id: String(payload.id || createRecipeId(name)).trim(),
    name,
    description: String(payload.description || "").trim(),
    cuisine: String(payload.cuisine || "").trim(),
    difficulty: String(payload.difficulty || "Easy").trim() || "Easy",
    timeMinutes: numericValue(payload.timeMinutes, 0),
    servings: numericValue(payload.servings, 2),
    ingredients,
    steps,
    nutrition,
    dietaryTags: normalizeRecipeArray(payload.dietaryTags)
      .map((tag) => String(tag || "").trim())
      .filter(Boolean),
    image: String(payload.image || "").trim(),
    status: String(payload.status || "pending").trim().toLowerCase() === "approved" ? "approved" : "pending"
  };
};

const ensureRecipeSubmissionsCollection = async () => {
  const collection = await getRecipeSubmissionsCollection();

  if (!collection) {
    return null;
  }

  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ status: 1 }),
    collection.createIndex({ submittedAt: -1 })
  ]);

  return collection;
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
      .find({ $or: [{ status: { $exists: false } }, { status: "approved" }] }, { projection: { _id: 0 } })
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
        replacement: {
          ...recipe,
          status: recipe.status || "approved"
        },
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

const submitRecipeForReview = async ({ recipe, submittedBy = null }) => {
  const collection = await ensureRecipeSubmissionsCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to submit recipes for review");
  }

  const normalizedRecipe = normalizeRecipeSubmission(recipe);
  const now = new Date();

  const document = {
    ...normalizedRecipe,
    submittedBy,
    submittedAt: now,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: ""
  };

  await collection.findOneAndUpdate(
    { id: document.id },
    {
      $set: {
        ...document,
        status: "pending",
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  return document;
};

const getPendingRecipeSubmissions = async () => {
  const collection = await ensureRecipeSubmissionsCollection();

  if (!collection) {
    return [];
  }

  return collection
    .find({ status: "pending" }, { projection: { _id: 0 } })
    .sort({ submittedAt: -1 })
    .toArray();
};

const approveRecipeSubmission = async ({ submissionId, reviewer = null }) => {
  const submissionsCollection = await ensureRecipeSubmissionsCollection();
  const recipesCollection = await getRecipesCollection();

  if (!submissionsCollection || !recipesCollection) {
    throw new Error("MONGODB_URI is required to approve recipes");
  }

  const submission = await submissionsCollection.findOne({ id: String(submissionId || "").trim() });

  if (!submission) {
    throw new Error("Recipe submission not found");
  }

  const now = new Date();
  const approvedRecipe = {
    id: submission.id,
    name: submission.name,
    description: submission.description || "",
    cuisine: submission.cuisine || "",
    difficulty: submission.difficulty || "Easy",
    timeMinutes: submission.timeMinutes || 0,
    servings: submission.servings || 2,
    ingredients: submission.ingredients || [],
    steps: submission.steps || [],
    nutrition: submission.nutrition || {},
    dietaryTags: submission.dietaryTags || [],
    image: submission.image || "",
    status: "approved",
    submittedBy: submission.submittedBy || null,
    submittedAt: submission.submittedAt || now,
    reviewedBy: reviewer,
    reviewedAt: now,
    reviewNote: "",
    updatedAt: now
  };

  await recipesCollection.replaceOne(
    { id: approvedRecipe.id },
    approvedRecipe,
    { upsert: true }
  );

  await submissionsCollection.updateOne(
    { id: approvedRecipe.id },
    {
      $set: {
        status: "approved",
        reviewedBy: reviewer,
        reviewedAt: now,
        reviewNote: "",
        updatedAt: now
      }
    }
  );

  return approvedRecipe;
};

const rejectRecipeSubmission = async ({ submissionId, reviewer = null, reviewNote = "" }) => {
  const submissionsCollection = await ensureRecipeSubmissionsCollection();

  if (!submissionsCollection) {
    throw new Error("MONGODB_URI is required to reject recipes");
  }

  const now = new Date();

  const result = await submissionsCollection.findOneAndUpdate(
    { id: String(submissionId || "").trim() },
    {
      $set: {
        status: "rejected",
        reviewedBy: reviewer,
        reviewedAt: now,
        reviewNote: String(reviewNote || "").trim(),
        updatedAt: now
      }
    },
    { returnDocument: "after" }
  );

  return result.value || null;
};

module.exports = {
  DATA_PATH,
  getRecipes,
  readRecipesFromJson,
  seedRecipesFromJson,
  normalizeRecipeSubmission,
  submitRecipeForReview,
  getPendingRecipeSubmissions,
  approveRecipeSubmission,
  rejectRecipeSubmission
};
