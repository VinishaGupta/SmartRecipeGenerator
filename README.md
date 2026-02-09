# Smart Recipe Generator (Core Engine)

This repository contains the core data and matching logic for the Smart Recipe Generator assessment.
It focuses on the recipe database, matching algorithm, dietary filtering, serving-size adjustments,
substitution suggestions, and a lightweight ingredient recognition stub.

## Highlights
- **Recipe database** with 20 multi-cuisine recipes including steps and nutrition.
- **Matching algorithm** that scores recipes based on ingredient overlap.
- **Dietary and filter support** for vegetarian, gluten-free, difficulty, and cooking time.
- **Serving size adjustments** with scaled nutrition values.
- **Rating + favorite hooks** for personalized recommendations.
- **Ingredient recognition stub** to wire into an ML service.

## Quick Start
```bash
npm install
npm start
```

## Files
- `data/recipes.json` – recipe dataset.
- `src/recipeEngine.js` – matching, filtering, ratings, substitutions.
- `src/ingredientRecognizer.js` – placeholder image ingredient detection.
- `docs/approach.md` – 200-word write-up of the approach.

## Next Steps
Connect the engine to a UI (React/Vue), add image inference via a free-tier vision API,
and deploy to Vercel/Netlify for a live demo.
