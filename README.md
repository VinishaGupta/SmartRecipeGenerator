# 🍳 Smart Recipe Generator

An AI-assisted cooking application that helps users discover recipes based on available ingredients, dietary preferences, and cooking constraints — all running locally with a clean web UI.

---

## 📌 Overview

**Smart Recipe Generator** allows users to:
- Input ingredients manually
- Select ingredients from categorized dropdowns
- Upload food images for ingredient detection

The system matches ingredients against a curated recipe dataset and ranks recipes by relevance.

This project focuses on **core logic**, **UI usability**, and **extensibility**, without relying on paid or third-party AI services.

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

---

### 🧠 Recipe Matching Engine
- Ingredient overlap scoring
- Ranked recipe results
- Match percentage shown for each recipe
- Real-time updates when filters change

---

### 🥗 Filters & Preferences
- Dietary preferences
  - Vegetarian
  - Gluten-free
- Cooking difficulty
  - Easy
  - Medium
  - Hard
- Maximum cooking time
- Adjustable servings

---

### 🔁 Ingredient Substitutions
- Built-in substitution suggestions for common ingredients  
  *(e.g. milk → oat milk, soy milk)*

---

### ⭐ Favorites & Ratings
- Favorite recipes stored locally using `localStorage`
- Rating system (1–5)
- Personalized suggestions based on user ratings

---

## 🧱 Tech Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js (lightweight HTTP server)
- **Data:** Local JSON recipe database
- **Storage:** Browser `localStorage`
- **AI Integration:** Local / pluggable (no external services required)

---

## 🚀 Quick Start

```bash
npm install
npm start
```

📦 Python Dependencies Installed

For local image recognition, the following Python libraries were installed using pip:

```bash
pip install torch torchvision pillow numpy
```

## 📁 Project Structure

```
.
├── data/
│   └── recipes.json              # Recipe dataset (JSON)
│
├── public/
│   ├── index.html                # UI layout
│   ├── styles.css                # App styling
│   └── app.js                    # Client-side logic
│
├── src/
│   ├── server.js                 # Local Node.js HTTP server
│   ├── recipeEngine.js           # Recipe matching & scoring logic
│   ├── ingredientRecognizer.js   # JS bridge for ingredient recognition
│   └── index.js                  # Entry point
│
├── vision/
│   ├── recognize.py              # Python image recognition script
│   └── imagenet_classes.txt      # ImageNet class labels for mapping
│
├── docs/
│   └── approach.md               # Design & approach explanation
│
├── README.md
└── package.json
```

### 🧪 How Recipe Matching Works
- User ingredients are normalized
- Recipes are scored by ingredient overlap
- Filters are applied (diet, difficulty, time)
- Recipes are ranked by match percentage
- Top results are displayed instantly

---

### 🐍 Python & Vision Integration

This project does not rely on paid APIs or third-party AI services.
Instead, it uses a local Python-based vision pipeline.

---

### 🔍 Image Recognition Flow
- Images uploaded in the UI are sent to the Node.js server
- Node.js invokes a Python script (recognize.py)
- A pretrained ImageNet-based CNN model is used
- Predicted labels are mapped to food ingredients using:
- -imagenet_classes.txt
- Curated ingredient lists in JavaScript

---

### 📦 Python Libraries Used
- torch
- torchvision
- Pillow
- numpy

These libraries are used to:
- Load a pretrained vision model
- Run image inference locally
- Convert predictions into usable ingredient names

---

### 🧠 Ingredient Mapping Strategy
- Raw ImageNet labels are not used directly
- Labels are matched against:
- - KNOWN_INGREDIENTS
  - Category-based ingredient lists
- This avoids noisy outputs (e.g. non-food objects)
- Only food-relevant ingredients are extracted

--- 

### Why This Architecture?
- ❌ No paid APIs
- ✅ Fully local
- ✅ Deterministic & reliable

---

### 🛠 Extensibility

This project is intentionally designed to be extended:
- Plug in a real image recognition API
- Add more recipe datasets
- Enhance the UI with React or Vue
- Add user accounts and cloud storage

---

### 🌐 Live Deployment

The Smart Recipe Generator has been successfully deployed and is publicly accessible.

Live URL:
👉 https://smartrecipegenerator-rbkj.onrender.com/

---

### 🚀 Deployment Details
- Platform: Render
- Frontend: Static build served via Render
- Backend: Local Node.js server (used during development)

Python Vision Pipeline:
- Runs locally only
- Not required for the deployed version
- Core app functionality works without it

---

### 📝 Notes on Deployment
- The deployed version focuses on:
- Ingredient input (text + dropdowns)
- Recipe matching & filtering
- Favorites and ratings (stored in browser localStorage)
- Image recognition remains optional and local, as it depends on Python and PyTorch
- No paid APIs or external AI services are used in production

### 📄 Notes

- No paid APIs required
- No external AI dependency
- Fully functional offline logic
- Suitable for assessments and demos

--- 

### 👩‍💻 Author

### 👩‍💻 Author
### 👩‍💻 Author

Built as part of a software engineering / web development assessment,
with a focus on clean architecture, usability, and extensibility.
