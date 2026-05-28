const { ObjectId } = require("mongodb");
const { getUsersCollection } = require("./mongodb");
const bcrypt = require("bcryptjs");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const normalizeRecipeIds = (recipeIds = []) =>
  Array.from(new Set(
    recipeIds
      .map((recipeId) => String(recipeId).trim())
      .filter(Boolean)
  ));

const normalizeUserRole = (role = "user") => {
  const normalizedRole = String(role || "").trim().toLowerCase();

  return normalizedRole === "admin" ? "admin" : "user";
};

const buildUserDocument = ({
  email,
  displayName = "",
  passwordHash = null,
  googleId = null,
  googleEmail = null,
  avatarUrl = null,
  provider = null,
  role = "user"
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

  const normalizedRole = normalizeUserRole(role);

  return {
    email: normalizedEmail,
    displayName,
    passwordHash,
    googleId,
    googleEmail: googleEmail ? normalizeEmail(googleEmail) : null,
    avatarUrl,
    role: normalizedRole,
    authProviders,
    favoriteRecipeIds: [],
    savedRecipeIds: [],
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
    collection.createIndex({ role: 1 }),
    collection.createIndex({ favoriteRecipeIds: 1 }),
    collection.createIndex({ savedRecipeIds: 1 })
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

const upsertLocalUser = async ({ email, passwordHash, displayName = "", role = "user" }) => {
  const collection = await ensureUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to create users");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeUserRole(role);
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $setOnInsert: {
        email: normalizedEmail,
        role: normalizedRole,
        favoriteRecipeIds: [],
        savedRecipeIds: [],
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

  return result.value || result;
};

const upsertGoogleUser = async ({ googleId, email, displayName = "", avatarUrl = null, role = "user" }) => {
  const collection = await ensureUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to create users");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedGoogleId = String(googleId || "").trim();
  const normalizedRole = normalizeUserRole(role);
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
        role: normalizedRole,
        favoriteRecipeIds: [],
        savedRecipeIds: [],
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

const findUserByAuthPayload = async (payload = {}) => {
  const collection = await getUsersCollection();

  if (!collection || !payload) {
    return null;
  }

  const queries = [];
  const sub = String(payload.sub || "").trim();

  if (sub && ObjectId.isValid(sub)) {
    queries.push({ _id: new ObjectId(sub) });
  }

  if (sub) {
    queries.push({ googleId: sub });
  }

  if (payload.email) {
    queries.push({ email: normalizeEmail(payload.email) });
  }

  if (!queries.length) {
    return null;
  }

  return collection.findOne({ $or: queries });
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

const addSavedRecipe = async (userId, recipeId) => {
  const collection = await getUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to update saved recipes");
  }

  const normalizedRecipeId = String(recipeId || "").trim();

  return collection.findOneAndUpdate(
    { _id: userId },
    {
      $addToSet: {
        savedRecipeIds: normalizedRecipeId
      },
      $set: {
        updatedAt: new Date()
      }
    },
    { returnDocument: "after" }
  );
};

const removeSavedRecipe = async (userId, recipeId) => {
  const collection = await getUsersCollection();

  if (!collection) {
    throw new Error("MONGODB_URI is required to update saved recipes");
  }

  const normalizedRecipeId = String(recipeId || "").trim();

  return collection.findOneAndUpdate(
    { _id: userId },
    {
      $pull: {
        savedRecipeIds: normalizedRecipeId
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
  normalizeUserRole,
  buildUserDocument,
  ensureUsersCollection,
  findUserByEmail,
  findUserByGoogleId,
  findUserByAuthPayload,
  hashPassword,
  verifyPassword,
  upsertLocalUser,
  upsertGoogleUser,
  recordLogin,
  setFavoriteRecipes,
  addFavoriteRecipe,
  removeFavoriteRecipe,
  addSavedRecipe,
  removeSavedRecipe
};
