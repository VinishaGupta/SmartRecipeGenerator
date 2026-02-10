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
- Selected ingredients sync automatically with the input field

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
- Favorite recipes stored locally
- Rating system (1–5)
- Personalized suggestions based on ratings

---

## 🧱 Tech Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js (lightweight HTTP server)
- **Data:** Local JSON recipe database
- **Storage:** Browser `localStorage`
- **AI Integration:** Pluggable (currently stubbed / local)

---

## 🚀 Quick Start

```bash
npm install
npm start
```
Then open:

```
http://localhost:3000
```

📁 Project Structure
```
.
├── data/
│   └── recipes.json          # Recipe dataset
│
├── public/
│   ├── index.html            # UI layout
│   ├── styles.css            # App styling
│   └── app.js                # Client-side logic
│
├── src/
│   └── server.js             # Local Node.js server
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

### 🛠 Extensibility
- This project is intentionally designed to be extended:
- Plug in a real image recognition API
- Add more recipe datasets
- Enhance UI with React or Vue
- Deploy to Vercel or Netlify
- Add user accounts and cloud storage

  ---

### 📄 Notes
- No paid APIs required
- No external AI dependency
- Fully functional offline logic
- Suitable for assessments and demos

  ---

### 👩‍💻 Author
Built as part of a software engineering / web development assessment,
with a focus on clean architecture, usability, and extensibility.
