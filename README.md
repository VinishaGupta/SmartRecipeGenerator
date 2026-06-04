# 🍳 Smart Recipe Generator

An AI-assisted cooking application that helps users discover recipes based on available ingredients, dietary preferences, and cooking constraints — now backed by MongoDB, Cloudinary image hosting, and an admin moderation workflow.

---

## 📌 Overview

**Smart Recipe Generator** lets users:
- Input ingredients manually
- Select ingredients from categorized dropdowns
- Upload food images for ingredient detection
- Submit their own recipes for approval

The system matches ingredients against curated recipes, ranks results by relevance, and supports user accounts with favorites, ratings, and admin moderation.

---

## ✨ Key Features

### 🧺 Ingredient Input
- Text input (comma-separated)
- Category-based dropdown selector
  - Vegetables
  - Fruits
  - Proteins
  - Grains
  - Dairy
- Multiple selections supported
- Selected ingredients automatically sync with the input field

### 🧠 Recipe Matching Engine
- Ingredient overlap scoring
- Ranked recipe results
- Match percentage shown for each recipe
- Real-time updates when filters change

### 🥗 Filters & Preferences
- Dietary preferences (Vegetarian, Gluten-free)
- Cooking difficulty (Easy, Medium, Hard)
- Maximum cooking time
- Adjustable servings

### 🔁 Ingredient Substitutions
- Built-in substitution suggestions for common ingredients

### ⭐ Accounts, Favorites & Ratings
- Google sign-in + user profiles
- Favorites and ratings persisted in MongoDB for signed-in users

### 🧾 Recipe Submission & Moderation
- Recipe submission form for users
- Submissions stored in a pending queue
- Admin panel to approve/reject recipes
- Approved recipes are published to the main catalog

### 🖼️ Cloudinary Images
- Recipe images served from Cloudinary with size-optimized URLs
- Fallback images when a recipe has no hosted image

---

## 🧱 Tech Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js (HTTP server)
- **Database:** MongoDB (users, submissions, ratings)
- **Images:** Cloudinary delivery URLs
- **AI Integration:** Local / pluggable (no external services required)

---

## 🚀 Quick Start

```bash
npm install
npm start
```

### 🔐 Environment Variables

Create a local `.env` file from `.env.example` and fill in your own values for:
- `MONGODB_URI`
- `MONGODB_DB`
- `MONGODB_RECIPES_COLLECTION`
- `MONGODB_USERS_COLLECTION`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `SESSION_SECRET`
- `JWT_SECRET`

Optional:
- `ALLOW_ADMIN_FALLBACK` (set to `1` to allow admin checks to fall back to token role)

### 📦 Optional Python Dependencies

For local image recognition, install:

```bash
pip install torch torchvision pillow numpy
```

---

## 📁 Project Structure

```
.
├── api/                          # API routes (Vercel)
├── data/                         # Local recipe seed data
├── docs/                         # Design notes
├── lib/                          # MongoDB helpers and domain logic
├── models/                       # Recipe model
├── public/                       # UI pages and client scripts
├── scripts/                      # Data/image utilities
├── src/                          # Core recipe engine + ingredient recognizer
├── vision/                       # Local Python vision pipeline
├── server.js                     # Node.js HTTP server
├── README.md
└── package.json
```

---

## 🧪 How Recipe Matching Works
- User ingredients are normalized
- Recipes are scored by ingredient overlap
- Filters are applied (diet, difficulty, time)
- Recipes are ranked by match percentage

---

## 🐍 Python & Vision Integration

The vision pipeline is optional and runs locally:
- Images uploaded in the UI are sent to the Node.js server
- The server invokes `vision/recognize.py`
- A pretrained ImageNet CNN model predicts labels
- Labels are mapped to food ingredients before matching

---

## 🌐 Live Deployment

Live URL:
👉 https://smartrecipegenerator-rbkj.onrender.com/

Notes:
- The deployed version includes the main app, user accounts, and moderation workflow
- The local Python vision pipeline is not required for production

---

## 🛠 Extensibility

- Plug in a production image recognition API
- Add new recipe datasets
- Enhance the UI with React or Vue
- Extend moderation with roles and audit logs

---

Built as part of a software engineering / web development assessment,
with a focus on clean architecture, usability, and extensibility.
