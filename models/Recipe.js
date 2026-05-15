const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      index: true
    },
    image: {
      type: String,
      default: ""
    }
  },
  {
    strict: false,
    versionKey: false
  }
);

const createRecipeModel = (connection, collectionName) =>
  connection.models.Recipe ||
  connection.model("Recipe", recipeSchema, collectionName);

module.exports = {
  createRecipeModel
};
