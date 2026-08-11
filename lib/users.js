const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { ObjectId } = require("mongodb");
const { getUsersCollection } = require("./mongodb");
const bcrypt = require("bcryptjs");

const USERS_DATA_PATH = path.join(__dirname, "..", "data", "users.json");

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

const normalizeStoredUser = (user = {}) => ({
  _id: String(user._id || randomUUID()),
  email: normalizeEmail(user.email),
  displayName: String(user.displayName || ""),
  passwordHash: user.passwordHash || null,
  googleId: user.googleId ? String(user.googleId).trim() : null,
  googleEmail: user.googleEmail ? normalizeEmail(user.googleEmail) : null,
  avatarUrl: user.avatarUrl || null,
  role: normalizeUserRole(user.role),
  authProviders: Array.from(new Set((Array.isArray(user.authProviders) ? user.authProviders : []).map((provider) => String(provider || "").trim()).filter(Boolean))),
  favoriteRecipeIds: normalizeRecipeIds(user.favoriteRecipeIds),
  savedRecipeIds: normalizeRecipeIds(user.savedRecipeIds),
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt || new Date().toISOString(),
  updatedAt: user.updatedAt || new Date().toISOString(),
  emailVerifiedAt: user.emailVerifiedAt || null
});

const readLocalUsers = async () => {
  try {
    const raw = await fs.readFile(USERS_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.map(normalizeStoredUser) : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    if (error instanceof SyntaxError) {
      try {
        const backupPath = `${USERS_DATA_PATH}.corrupt-${Date.now()}`;
        await fs.rename(USERS_DATA_PATH, backupPath);
        console.warn(`Recovered malformed local users store by moving it to ${backupPath}`);
      } catch (renameError) {
        console.warn("Could not back up malformed local users store:", renameError.message);
      }

      return [];
    }

    throw error;
  }
};

const writeLocalUsers = async (users) => {
  const normalizedUsers = (Array.isArray(users) ? users : []).map(normalizeStoredUser);

  await fs.mkdir(path.dirname(USERS_DATA_PATH), { recursive: true });
  const tempPath = `${USERS_DATA_PATH}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(normalizedUsers, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, USERS_DATA_PATH);

  return normalizedUsers;
};

const getUsersCollectionOrNull = async () => {
  try {
    return await getUsersCollection();
  } catch (error) {
    return null;
  }
};

const findLocalUserByEmail = async (email) => {
  const users = await readLocalUsers();
  const normalizedEmail = normalizeEmail(email);

  return users.find((user) => user.email === normalizedEmail) || null;
};

const findLocalUserByGoogleId = async (googleId) => {
  const users = await readLocalUsers();
  const normalizedGoogleId = String(googleId || "").trim();

  return users.find((user) => String(user.googleId || "").trim() === normalizedGoogleId) || null;
};

const findLocalUserById = async (userId) => {
  const users = await readLocalUsers();
  const normalizedUserId = String(userId || "").trim();

  return users.find((user) => String(user._id || "").trim() === normalizedUserId) || null;
};

const upsertLocalUserRecord = async (matcher, updater) => {
  const users = await readLocalUsers();
  const index = users.findIndex(matcher);
  const currentUser = index >= 0 ? users[index] : null;
  const nextUser = normalizeStoredUser(updater(currentUser));

  if (index >= 0) {
    users[index] = nextUser;
  } else {
    users.push(nextUser);
  }

  await writeLocalUsers(users);
  return nextUser;
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
  const collection = await getUsersCollectionOrNull();

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
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    return findLocalUserByEmail(email);
  }

  return collection.findOne({ email: normalizeEmail(email) });
};

const findUserByGoogleId = async (googleId) => {
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    return findLocalUserByGoogleId(googleId);
  }

  return collection.findOne({ googleId: String(googleId || "").trim() });
};

const upsertLocalUser = async ({ email, passwordHash, displayName = "", role = "user" }) => {
  const collection = await ensureUsersCollection();

  if (!collection) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeUserRole(role);
    const now = new Date().toISOString();

    return upsertLocalUserRecord(
      (user) => user.email === normalizedEmail,
      (currentUser) => ({
        ...(currentUser || {}),
        email: normalizedEmail,
        displayName,
        passwordHash,
        role: normalizedRole,
        authProviders: Array.from(new Set([...(currentUser?.authProviders || []), "local"])),
        favoriteRecipeIds: currentUser?.favoriteRecipeIds || [],
        savedRecipeIds: currentUser?.savedRecipeIds || [],
        createdAt: currentUser?.createdAt || now,
        emailVerifiedAt: currentUser?.emailVerifiedAt || null,
        updatedAt: now,
        lastLoginAt: now
      })
    );
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
    const normalizedEmail = normalizeEmail(email);
    const normalizedGoogleId = String(googleId || "").trim();
    const normalizedRole = normalizeUserRole(role);
    const now = new Date().toISOString();

    return upsertLocalUserRecord(
      (user) => user.googleId === normalizedGoogleId || user.email === normalizedEmail,
      (currentUser) => ({
        ...(currentUser || {}),
        email: normalizedEmail,
        googleId: normalizedGoogleId,
        googleEmail: normalizedEmail,
        displayName,
        avatarUrl,
        role: normalizedRole,
        authProviders: Array.from(new Set([...(currentUser?.authProviders || []), "google"])),
        favoriteRecipeIds: currentUser?.favoriteRecipeIds || [],
        savedRecipeIds: currentUser?.savedRecipeIds || [],
        createdAt: currentUser?.createdAt || now,
        emailVerifiedAt: now,
        updatedAt: now,
        lastLoginAt: now
      })
    );
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
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    return upsertLocalUserRecord(
      (user) => String(user._id || "").trim() === String(userId || "").trim(),
      (currentUser) => ({
        ...(currentUser || {}),
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    );
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
  const collection = await getUsersCollectionOrNull();

  if (!collection || !payload) {
    const queries = [];
    const sub = String(payload.sub || "").trim();

    if (sub) {
      queries.push((user) => String(user._id || "").trim() === sub);
      queries.push((user) => String(user.googleId || "").trim() === sub);
    }

    if (payload.email) {
      const normalizedEmail = normalizeEmail(payload.email);
      queries.push((user) => user.email === normalizedEmail);
    }

    if (!queries.length) {
      return null;
    }

    const users = await readLocalUsers();
    return users.find((user) => queries.some((query) => query(user))) || null;
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
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    return upsertLocalUserRecord(
      (user) => String(user._id || "").trim() === String(userId || "").trim(),
      (currentUser) => ({
        ...(currentUser || {}),
        favoriteRecipeIds: normalizeRecipeIds(recipeIds),
        updatedAt: new Date().toISOString()
      })
    );
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
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    const normalizedRecipeId = String(recipeId || "").trim();

    return upsertLocalUserRecord(
      (user) => String(user._id || "").trim() === String(userId || "").trim(),
      (currentUser) => ({
        ...(currentUser || {}),
        favoriteRecipeIds: normalizeRecipeIds([...(currentUser?.favoriteRecipeIds || []), normalizedRecipeId]),
        updatedAt: new Date().toISOString()
      })
    );
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
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    const normalizedRecipeId = String(recipeId || "").trim();

    return upsertLocalUserRecord(
      (user) => String(user._id || "").trim() === String(userId || "").trim(),
      (currentUser) => ({
        ...(currentUser || {}),
        favoriteRecipeIds: normalizeRecipeIds((currentUser?.favoriteRecipeIds || []).filter((id) => String(id) !== normalizedRecipeId)),
        updatedAt: new Date().toISOString()
      })
    );
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
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    const normalizedRecipeId = String(recipeId || "").trim();

    return upsertLocalUserRecord(
      (user) => String(user._id || "").trim() === String(userId || "").trim(),
      (currentUser) => ({
        ...(currentUser || {}),
        savedRecipeIds: normalizeRecipeIds([...(currentUser?.savedRecipeIds || []), normalizedRecipeId]),
        updatedAt: new Date().toISOString()
      })
    );
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
  const collection = await getUsersCollectionOrNull();

  if (!collection) {
    const normalizedRecipeId = String(recipeId || "").trim();

    return upsertLocalUserRecord(
      (user) => String(user._id || "").trim() === String(userId || "").trim(),
      (currentUser) => ({
        ...(currentUser || {}),
        savedRecipeIds: normalizeRecipeIds((currentUser?.savedRecipeIds || []).filter((id) => String(id) !== normalizedRecipeId)),
        updatedAt: new Date().toISOString()
      })
    );
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
