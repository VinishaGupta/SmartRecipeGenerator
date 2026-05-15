require("dotenv").config();

const { getMongoClient, getMongoConfig } = require("../lib/mongodb");
const { seedRecipesFromJson } = require("../lib/recipes");

(async () => {
  const { dbName, collectionName } = getMongoConfig();
  const result = await seedRecipesFromJson();

  console.log(`Seeded recipes into ${dbName}.${collectionName}`);
  console.log(result);

  const client = await getMongoClient();
  await client.close();
})().catch((error) => {
  console.error("Recipe seed failed:", error.message);
  process.exitCode = 1;
});
