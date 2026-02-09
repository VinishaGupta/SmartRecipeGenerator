The core of the Smart Recipe Generator is a small, testable data and matching layer that can be
plugged into any UI. I modeled recipes in a JSON database with 20 entries spanning cuisines,
levels, and nutrition metadata. The matching algorithm normalizes ingredient input, filters by
user preferences (dietary tags, difficulty, time), and scores each recipe by ingredient overlap.
Top matches are returned with optional serving-size scaling, which also adjusts nutrition values
for consistent UX. A substitution map provides fallback suggestions for common allergens or
restricted items.

For ingredient recognition, I included a lightweight stub that derives probable ingredients from
image filenames. This makes it easy to swap in a real ML integration (e.g., Google Vision, AWS
Rekognition, or a free-tier open-source model) without changing the rest of the pipeline. Ratings
and favorites are stored in a simple in-memory map/set to demonstrate how personalized
recommendations could be generated, and a `suggestRecipesByRatings` utility can be fed with real
user data once persistence is added.

This separation keeps business logic clean, supports error handling and loading states in the UI,
and makes it straightforward to deploy on Vercel or Netlify with a lightweight front end.
