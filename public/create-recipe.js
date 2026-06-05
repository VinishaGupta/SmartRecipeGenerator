const RENDER_BACKEND_URL = "https://smartrecipegenerator-rbkj.onrender.com";
const DRAFT_KEY = "recipeDraft";

const getBackendBaseUrl = () => {
  const host = window.location.hostname;

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".onrender.com")
  ) {
    return "";
  }

  return RENDER_BACKEND_URL;
};

const apiUrl = (path) => `${getBackendBaseUrl()}${path}`;

const addIngredientBtn = document.getElementById("addIngredientBtn");
const ingredientRows = document.getElementById("ingredientRows");
const addStepBtn = document.getElementById("addStepBtn");
const stepRows = document.getElementById("stepRows");
const creatorStatus = document.getElementById("creatorStatus");
const creatorImageInput = document.getElementById("creatorImageInput");
const creatorHeroUpload = document.querySelector(".creator-hero-upload");
const creatorHeroLabel = creatorHeroUpload?.querySelector("label");
const submissionSuccessModal = document.getElementById("submissionSuccessModal");
const closeSubmissionSuccessModal = document.getElementById("closeSubmissionSuccessModal");
const submissionSuccessContinue = document.getElementById("submissionSuccessContinue");

const initialTitleValue = document.querySelector(".recipe-basics input")?.value || "";
const initialDescriptionValue = document.querySelector(".recipe-basics textarea")?.value || "";
const initialTagsHtml = document.querySelector(".creator-tags")?.innerHTML || "";
const initialIngredientRowsHtml = ingredientRows?.innerHTML || "";
const initialStepRowsHtml = stepRows?.innerHTML || "";

const DEFAULT_HERO_BACKGROUND =
  'linear-gradient(rgba(20, 16, 14, 0.36), rgba(20, 16, 14, 0.36)), url("https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=1300&q=80") center / cover';

const setStatus = (message, state = "") => {
  if (!creatorStatus) {
    return;
  }

  creatorStatus.textContent = message;
  creatorStatus.dataset.state = state;
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(String(value || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const setHeroBackground = (imageUrl = "") => {
  if (!creatorHeroUpload) {
    return;
  }

  creatorHeroUpload.style.background = imageUrl
    ? `linear-gradient(rgba(20, 16, 14, 0.28), rgba(20, 16, 14, 0.28)), url("${imageUrl}") center / cover`
    : DEFAULT_HERO_BACKGROUND;

  if (creatorHeroLabel) {
    creatorHeroLabel.dataset.previewState = imageUrl ? "selected" : "default";
  }
};

const openSubmissionSuccessModal = () => {
  if (submissionSuccessModal) {
    submissionSuccessModal.removeAttribute("hidden");
  }

  if (window.lucide) {
    lucide.createIcons();
  }
};

const closeSubmissionSuccessModalBox = () => {
  if (submissionSuccessModal) {
    submissionSuccessModal.setAttribute("hidden", "");
  }
};

const resetCreateRecipePage = () => {
  const titleInput = document.querySelector(".recipe-basics input");
  const descriptionInput = document.querySelector(".recipe-basics textarea");
  const tagsContainer = document.querySelector(".creator-tags");

  if (titleInput) {
    titleInput.value = initialTitleValue;
  }

  if (descriptionInput) {
    descriptionInput.value = initialDescriptionValue;
  }

  if (tagsContainer) {
    tagsContainer.innerHTML = initialTagsHtml;
  }

  if (ingredientRows) {
    ingredientRows.innerHTML = initialIngredientRowsHtml;
  }

  if (stepRows) {
    stepRows.innerHTML = initialStepRowsHtml;
  }

  if (creatorImageInput) {
    creatorImageInput.value = "";
  }

  if (creatorHeroUpload) {
    creatorHeroUpload.style.background = "";
  }

  if (creatorHeroLabel) {
    creatorHeroLabel.dataset.previewState = "default";
  }

  localStorage.removeItem(DRAFT_KEY);
  setStatus("", "");

  if (window.lucide) {
    lucide.createIcons();
  }
};

const getIngredientRows = () => Array.from(ingredientRows?.querySelectorAll(".ingredient-editor-row") || []);
const getStepRows = () => Array.from(stepRows?.querySelectorAll("article") || []);

const collectIngredients = () => getIngredientRows().map((row) => {
  const inputs = row.querySelectorAll("input");
  return {
    quantity: inputs[0]?.value || "",
    unit: inputs[1]?.value || "",
    name: inputs[2]?.value || ""
  };
}).filter((ingredient) => String(ingredient.name || "").trim());

const collectSteps = () => getStepRows().map((row) => row.querySelector("textarea")?.value || "").filter(Boolean);

const collectTags = () => Array.from(document.querySelectorAll(".creator-tags span"))
  .map((tag) => tag.textContent.replace(/x\s*$/i, "").trim())
  .filter(Boolean);

const collectNutrition = () => {
  const cards = Array.from(document.querySelectorAll(".nutrition-editor-grid article"));
  const keys = ["calories", "protein", "carbs", "fat"];

  return keys.reduce((nutrition, key, index) => {
    const valueText = cards[index]?.querySelector("strong")?.textContent || "0";
    nutrition[key] = parseNumber(valueText, 0);
    return nutrition;
  }, {});
};

const collectRecipePayload = async () => {
  const title = document.querySelector(".recipe-basics input")?.value.trim() || "";
  const description = document.querySelector(".recipe-basics textarea")?.value.trim() || "";
  const timeText = document.querySelector(".creator-time-card strong")?.textContent || "0";
  const imageFile = creatorImageInput?.files?.[0] || null;
  let image = "";

  if (imageFile) {
    image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(imageFile);
    });
  }

  return {
    name: title,
    description,
    cuisine: "",
    difficulty: "Easy",
    timeMinutes: parseNumber(timeText, 0),
    servings: 2,
    ingredients: collectIngredients(),
    steps: collectSteps(),
    nutrition: collectNutrition(),
    dietaryTags: collectTags(),
    image
  };
};

const updateHeroPreviewFromFile = (file) => {
  if (!file) {
    setHeroBackground("");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => setHeroBackground(String(reader.result || ""));
  reader.onerror = () => setHeroBackground("");
  reader.readAsDataURL(file);
};

const saveDraft = async () => {
  const draft = await collectRecipePayload();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  setStatus("Draft saved locally.", "success");
};

const submitForApproval = async () => {
  const payload = await collectRecipePayload();

  if (!payload.name) {
    setStatus("Add a recipe title before submitting.", "error");
    return;
  }

  if (!payload.ingredients.length) {
    setStatus("Add at least one ingredient before submitting.", "error");
    return;
  }

  if (!payload.steps.length) {
    setStatus("Add at least one preparation step before submitting.", "error");
    return;
  }

  setStatus("Submitting recipe for review...", "loading");

  try {
    const response = await fetch(apiUrl("/api/recipe-submissions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.details || data?.error || "Submission failed");
    }

    setStatus("Recipe submitted for admin approval.", "success");
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    resetCreateRecipePage();
    openSubmissionSuccessModal();
  } catch (error) {
    setStatus(error.message || "Could not submit recipe.", "error");
  }
};

const restoreDraft = () => {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");

    if (!draft) {
      return;
    }

    const titleInput = document.querySelector(".recipe-basics input");
    const descriptionInput = document.querySelector(".recipe-basics textarea");

    if (titleInput && draft.name) {
      titleInput.value = draft.name;
    }

    if (descriptionInput && draft.description) {
      descriptionInput.value = draft.description;
    }

    if (draft.image) {
      setHeroBackground(draft.image);
    }
  } catch (error) {
    console.debug("Draft restore failed:", error);
  }
};

if (addIngredientBtn && ingredientRows) {
  addIngredientBtn.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "ingredient-editor-row";
    row.innerHTML = `
      <i data-lucide="grip-vertical"></i>
      <input placeholder="Qty" />
      <input placeholder="Unit" />
      <input placeholder="Ingredient name" />
    `;
    ingredientRows.appendChild(row);
    if (window.lucide) {
      lucide.createIcons();
    }
  });
}

if (addStepBtn && stepRows) {
  addStepBtn.addEventListener("click", () => {
    const stepNumber = getStepRows().length + 1;
    const article = document.createElement("article");
    article.innerHTML = `
      <span>${stepNumber}</span>
      <textarea placeholder="Describe the next preparation step..."></textarea>
    `;
    stepRows.insertBefore(article, addStepBtn);
  });
}

Array.from(document.querySelectorAll(".creator-primary, .creator-secondary.filled")).forEach((button) => {
  const label = button.textContent || "";

  if (label.includes("Submit for Approval")) {
    button.addEventListener("click", submitForApproval);
  }

  if (label.includes("Save as Draft")) {
    button.addEventListener("click", saveDraft);
  }
});

// Prefer direct ID wiring for reliability
const headerSubmitBtn = document.getElementById("submitForApprovalBtnHeader");
const footerSubmitBtn = document.getElementById("submitForApprovalBtn");
const saveDraftBtn = Array.from(document.querySelectorAll(".creator-secondary.filled")).find(b => (b.textContent || "").includes("Save as Draft"));

if (headerSubmitBtn) headerSubmitBtn.addEventListener("click", submitForApproval);
if (footerSubmitBtn) footerSubmitBtn.addEventListener("click", submitForApproval);
if (saveDraftBtn) saveDraftBtn.addEventListener("click", saveDraft);

if (closeSubmissionSuccessModal) {
  closeSubmissionSuccessModal.addEventListener("click", closeSubmissionSuccessModalBox);
}

if (submissionSuccessContinue) {
  submissionSuccessContinue.addEventListener("click", closeSubmissionSuccessModalBox);
}

if (submissionSuccessModal) {
  submissionSuccessModal.addEventListener("click", (event) => {
    if (event.target === submissionSuccessModal) {
      closeSubmissionSuccessModalBox();
    }
  });
}

restoreDraft();

if (creatorImageInput) {
  creatorImageInput.addEventListener("change", () => {
    updateHeroPreviewFromFile(creatorImageInput.files?.[0] || null);
  });
}

setHeroBackground("");
