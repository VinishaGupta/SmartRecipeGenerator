const { MongoClient } = require("mongodb");

let clientPromise;

const getMongoConfig = () => ({
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB || "SmartRecipeGenerator",
  collectionName: process.env.MONGODB_RECIPES_COLLECTION || "Recipes",
  usersCollectionName: process.env.MONGODB_USERS_COLLECTION || "Users"
});

const getMongoClient = async () => {
  const { uri } = getMongoConfig();

  if (!uri) {
    return null;
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000
    });
    clientPromise = client.connect();
  }

  return clientPromise;
};

const getRecipesCollection = async () => {
  const client = await getMongoClient();

  if (!client) {
    return null;
  }

  const { dbName, collectionName } = getMongoConfig();
  return client.db(dbName).collection(collectionName);
};

const getUsersCollection = async () => {
  const client = await getMongoClient();

  if (!client) {
    return null;
  }

  const { dbName, usersCollectionName } = getMongoConfig();
  return client.db(dbName).collection(usersCollectionName);
};

const pingMongo = async () => {
  const client = await getMongoClient();

  if (!client) {
    return false;
  }

  const { dbName } = getMongoConfig();
  await client.db(dbName).admin().ping();
  return true;
};

module.exports = {
  getMongoConfig,
  getMongoClient,
  getRecipesCollection,
  getUsersCollection,
  pingMongo
};
