const { getUsersCollection } = require("./mongodb");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const normalizeRecipeIds = (recipeIds = []) =>
  Array.from(new Set(
    recipeIds
      .map((recipeId) => String(recipeId).trim())
      .filter(Boolean)
  ));

const buildUserDocument = ({
  email,
  displayName = "",
  passwordHash = null,
  googleId = null,
  googleEmail = null,
  avatarUrl = null,
  provider = null
}) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("User email is required");
  }

  const authProviders = [];

  if (passwordHash) {
    authProviders.push("local");
  }

  if (googleId) {
    authProviders.push("google");
  }

  if (provider && !authProviders.includes(provider)) {
    authProviders.push(provider);
  }

  return {
    email: normalizedEmail,
    displayName,
    passwordHash,
    googleId,
    googleEmail: googleEmail ? normalizeEmail(googleEmail) : null,
    avatarUrl,
    authProviders,
    favoriteRecipeIds: [],
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerifiedAt: null
  };
};

const ensureUsersCollection = async () => {
  const collection = await getUsersCollection();

  if (!collection) {
    return null;
  }

  await Promise.all([
    collection.createIndex({ email: 1 }, { unique: true, sparse: true }),
    collection.createIndex({ googleId: 1 }, { unique: true, sparse: true }),
    collection.createIndex({ favoriteRecipeIds: 1 })
  ]);

  return collection;
};

const findUserByEmail = async (email) => {
  const collection = await getUsersCollection();

  if (!collection) {
    return null;
  }

  return collection.findOne({ email: normalizeEmail(email) });
};

const findUserByGoogleId = async (googleId) => {
  const collection = await getUsersCollection();

  if (!collection) {
    return null;
  }

  return collection.findOne({ googleId: String(googleId || "").trim() });
};

const upsertLocalUser = async ({ email, passwordHash, displayName = "" }) => {
  const collection = await ensureUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to create users");
  }

  const normalizedEmail = normalizeEmail(email);
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $setOnInsert: {
        email: normalizedEmail,
        favoriteRecipeIds: [],
        createdAt: now,
        emailVerifiedAt: null
      },
      $set: {
        displayName,
        passwordHash,
        updatedAt: now,
        lastLoginAt: now
      },
      $addToSet: {
        authProviders: "local"
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  return result.value;
};

const upsertGoogleUser = async ({ googleId, email, displayName = "", avatarUrl = null }) => {
  const collection = await ensureUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to create users");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedGoogleId = String(googleId || "").trim();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    {
      $or: [
        { googleId: normalizedGoogleId },
        { email: normalizedEmail }
      ]
    },
    {
      $setOnInsert: {
        email: normalizedEmail,
        favoriteRecipeIds: [],
        createdAt: now,
        emailVerifiedAt: now
      },
      $set: {
        googleId: normalizedGoogleId,
        googleEmail: normalizedEmail,
        displayName,
        avatarUrl,
        updatedAt: now,
        lastLoginAt: now,
        emailVerifiedAt: now
      },
      $addToSet: {
        authProviders: "google"
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  return result.value;
};

const recordLogin = async (userId) => {
  const collection = await getUsersCollection();

  if (!collection) {
    return null;
  }

  return collection.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        lastLoginAt: new Date(),
        updatedAt: new Date()
      }
    },
    { returnDocument: "after" }
  );
};

const setFavoriteRecipes = async (userId, recipeIds = []) => {
  const collection = await getUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to update favorites");
  }

  const normalizedRecipeIds = normalizeRecipeIds(recipeIds);

  return collection.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        favoriteRecipeIds: normalizedRecipeIds,
        updatedAt: new Date()
      }
    },
    { returnDocument: "after" }
  );
};

const addFavoriteRecipe = async (userId, recipeId) => {
  const collection = await getUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to update favorites");
  }

  const normalizedRecipeId = String(recipeId || "").trim();

  return collection.findOneAndUpdate(
    { _id: userId },
    {
      $addToSet: {
        favoriteRecipeIds: normalizedRecipeId
      },
      $set: {
        updatedAt: new Date()
      }
    },
    { returnDocument: "after" }
  );
};

const removeFavoriteRecipe = async (userId, recipeId) => {
  const collection = await getUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to update favorites");
  }

  const normalizedRecipeId = String(recipeId || "").trim();

  return collection.findOneAndUpdate(
    { _id: userId },
    {
      $pull: {
        favoriteRecipeIds: normalizedRecipeId
      },
      $set: {
        updatedAt: new Date()
      }
    },
    { returnDocument: "after" }
  );
};

module.exports = {
  normalizeEmail,
  normalizeRecipeIds,
  buildUserDocument,
  ensureUsersCollection,
  findUserByEmail,
  findUserByGoogleId,
  upsertLocalUser,
  upsertGoogleUser,
  recordLogin,
  setFavoriteRecipes,
  addFavoriteRecipe,
  removeFavoriteRecipe
};