const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { createHash } = require("crypto");
const { ObjectId } = require("mongodb");
const { getRecipesCollection, getRecipeSubmissionsCollection, getRecipeRatingsCollection } = require("./mongodb");

const DATA_PATH = path.join(__dirname, "..", "data", "recipes.json");

const readRecipesFromJson = async () => {
  const data = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(data)
    .filter((recipe) => recipe.status !== "pending" && recipe.status !== "rejected")
    .map((recipe) => ({
      ...recipe,
      averageRating: Number(recipe.averageRating || 0),
      totalRatings: Number(recipe.totalRatings || 0),
      userRating: null
    }));
};

const normalizeRatingValue = (value) => {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  return rating;
};

const toObjectId = (value) => {
  if (value instanceof ObjectId) {
    return value;
  }

  const stringValue = String(value || "").trim();

  if (!stringValue || !ObjectId.isValid(stringValue)) {
    return null;
  }

  return new ObjectId(stringValue);
};

const slugifyRecipeId = (value) =>
  String(value || "recipe")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "recipe";

const createRecipeId = (name) => `recipe-${slugifyRecipeId(name)}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

const getCloudinaryConfig = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || "djsenbil3",
  apiKey: process.env.CLOUDINARY_API_KEY || "",
  apiSecret: process.env.CLOUDINARY_API_SECRET || ""
});

const isDataImageUrl = (value) => /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || "").trim());

const buildRecipeImagePublicId = (recipeId) => `smart-recipe-generator/${slugifyRecipeId(recipeId)}`;

const signCloudinaryParams = (params, apiSecret) => {
  const signatureSource = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${signatureSource}${apiSecret}`).digest("hex");
};

const uploadRecipeImageToCloudinary = async ({ imageDataUrl, publicId }) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const uploadParams = {
    public_id: publicId,
    timestamp,
    overwrite: "true"
  };

  const body = new URLSearchParams({
    file: imageDataUrl,
    api_key: apiKey,
    public_id: publicId,
    timestamp,
    overwrite: "true",
    signature: signCloudinaryParams(uploadParams, apiSecret)
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.error) {
    throw new Error(result?.error?.message || "Cloudinary upload failed");
  }

  return result;
};

const deleteRecipeImageFromCloudinary = async ({ publicId }) => {
  const normalizedPublicId = String(publicId || "").trim();
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

  if (!normalizedPublicId || !cloudName || !apiKey || !apiSecret) {
    return false;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const destroyParams = {
    public_id: normalizedPublicId,
    timestamp,
    invalidate: "true"
  };

  const body = new URLSearchParams({
    public_id: normalizedPublicId,
    api_key: apiKey,
    timestamp,
    invalidate: "true",
    signature: signCloudinaryParams(destroyParams, apiSecret)
  });

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.error) {
    throw new Error(result?.error?.message || "Cloudinary deletion failed");
  }

  return true;
};

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

const ensureRecipeRatingsCollection = async () => {
  const collection = await getRecipeRatingsCollection();

  if (!collection) {
    return null;
  }

  await Promise.all([
    collection.createIndex({ recipeId: 1, userId: 1 }, { unique: true }),
    collection.createIndex({ recipeId: 1 }),
    collection.createIndex({ userId: 1 }),
    collection.createIndex({ createdAt: -1 })
  ]);

  return collection;
};

const hydrateRecipesWithRatings = async ({ recipes, userId = null }) => {
  const normalizedRecipes = Array.isArray(recipes) ? recipes : [];

  if (!normalizedRecipes.length) {
    return [];
  }

  let ratingsCollection = null;

  try {
    ratingsCollection = await getRecipeRatingsCollection();
  } catch (error) {
    console.warn("MongoDB recipe ratings unavailable, continuing without ratings:", error.message);
  }

  const recipeIds = normalizedRecipes
    .map((recipe) => recipe._id)
    .filter(Boolean);

  const baseRecipes = normalizedRecipes.map((recipe) => {
    const { _id, ...publicRecipe } = recipe;

    return {
      ...publicRecipe,
      averageRating: Number(recipe.averageRating || 0),
      totalRatings: Number(recipe.totalRatings || 0),
      userRating: null
    };
  });

  if (!ratingsCollection || !recipeIds.length) {
    return baseRecipes;
  }

  const userObjectId = toObjectId(userId);
  let aggregates = [];
  let userRatings = [];

  try {
    const aggregatePromise = ratingsCollection.aggregate([
      { $match: { recipeId: { $in: recipeIds } } },
      {
        $group: {
          _id: "$recipeId",
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 }
        }
      }
    ]).toArray();

    const userRatingsPromise = userObjectId
      ? ratingsCollection.find(
          { recipeId: { $in: recipeIds }, userId: userObjectId },
          { projection: { _id: 0, recipeId: 1, rating: 1 } }
        ).toArray()
      : Promise.resolve([]);

    [aggregates, userRatings] = await Promise.all([aggregatePromise, userRatingsPromise]);
  } catch (error) {
    console.warn("MongoDB recipe rating hydration failed, using stored/default values:", error.message);
    return baseRecipes;
  }

  const aggregateByRecipeId = new Map(
    aggregates.map((entry) => [String(entry._id), {
      averageRating: Number(entry.averageRating || 0),
      totalRatings: Number(entry.totalRatings || 0)
    }])
  );

  const userRatingByRecipeId = new Map(
    userRatings.map((entry) => [String(entry.recipeId), Number(entry.rating || 0)])
  );

  return baseRecipes.map((recipe) => {
    const recipeId = String(recipe._id || recipe.id || "");
    const aggregate = aggregateByRecipeId.get(recipeId) || {};

    return {
      ...recipe,
      averageRating: Number.isFinite(Number(aggregate.averageRating))
        ? Number(aggregate.averageRating)
        : Number(recipe.averageRating || 0),
      totalRatings: Number.isFinite(Number(aggregate.totalRatings))
        ? Number(aggregate.totalRatings)
        : Number(recipe.totalRatings || 0),
      userRating: userRatingByRecipeId.get(recipeId) || null
    };
  });
};

const getRecipes = async ({ userId = null } = {}) => {
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
      .find({ $or: [{ status: { $exists: false } }, { status: "approved" }] })
      .sort({ id: 1 })
      .toArray();
  } catch (error) {
    console.warn("MongoDB recipes unavailable, falling back to JSON:", error.message);
    return readRecipesFromJson();
  }

  if (!recipes.length) {
    return readRecipesFromJson();
  }

  return hydrateRecipesWithRatings({ recipes, userId });
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
  const rawImage = String(normalizedRecipe.image || "").trim();
  let uploadedImage = null;

  if (isDataImageUrl(rawImage)) {
    const publicId = buildRecipeImagePublicId(normalizedRecipe.id);
    uploadedImage = await uploadRecipeImageToCloudinary({
      imageDataUrl: rawImage,
      publicId
    });

    normalizedRecipe.image = uploadedImage.public_id || publicId;
    normalizedRecipe.imageUrl = uploadedImage.secure_url || "";
    normalizedRecipe.imagePublicId = uploadedImage.public_id || publicId;
  }

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
    imageUrl: submission.imageUrl || "",
    imagePublicId: submission.imagePublicId || submission.image || "",
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
  const submission = await submissionsCollection.findOne({ id: String(submissionId || "").trim() });

  if (submission) {
    const imagePublicId = String(submission.imagePublicId || submission.image || "").trim();

    if (imagePublicId && !isDataImageUrl(imagePublicId) && !/^https?:\/\//i.test(imagePublicId)) {
      await deleteRecipeImageFromCloudinary({ publicId: imagePublicId }).catch((error) => {
        console.warn("Cloudinary cleanup failed for rejected submission:", error.message);
      });
    }
  }

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

const rateRecipe = async ({ recipeId, userId, rating }) => {
  const recipesCollection = await getRecipesCollection();
  const ratingsCollection = await ensureRecipeRatingsCollection();

  if (!recipesCollection || !ratingsCollection) {
    throw new Error("MONGODB_URI is required to rate recipes");
  }

  const normalizedRating = normalizeRatingValue(rating);
  const normalizedRecipeId = String(recipeId || "").trim();
  const userObjectId = toObjectId(userId);

  if (!normalizedRecipeId) {
    throw new Error("Recipe id is required");
  }

  if (!userObjectId) {
    throw new Error("User id is required");
  }

  const recipe = await recipesCollection.findOne({ id: normalizedRecipeId }, { projection: { _id: 1, averageRating: 1, totalRatings: 1 } });

  if (!recipe) {
    return null;
  }

  const now = new Date();

  await ratingsCollection.findOneAndUpdate(
    { recipeId: recipe._id, userId: userObjectId },
    {
      $set: {
        rating: normalizedRating,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  const aggregates = await ratingsCollection.aggregate([
    { $match: { recipeId: recipe._id } },
    {
      $group: {
        _id: "$recipeId",
        averageRating: { $avg: "$rating" },
        totalRatings: { $sum: 1 }
      }
    }
  ]).toArray();

  const aggregate = aggregates[0] || { averageRating: 0, totalRatings: 0 };
  const averageRating = Number((Number(aggregate.averageRating || 0)).toFixed(1));
  const totalRatings = Number(aggregate.totalRatings || 0);

  await recipesCollection.updateOne(
    { _id: recipe._id },
    {
      $set: {
        averageRating,
        totalRatings,
        updatedAt: now
      }
    }
  );

  const userRatingDoc = await ratingsCollection.findOne(
    { recipeId: recipe._id, userId: userObjectId },
    { projection: { _id: 0, rating: 1 } }
  );

  return {
    averageRating,
    totalRatings,
    userRating: Number(userRatingDoc?.rating || normalizedRating)
  };
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
  rejectRecipeSubmission,
  rateRecipe,
  normalizeRatingValue,
  hydrateRecipesWithRatings
};
