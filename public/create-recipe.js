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
const saveDraftBtn = document.getElementById("saveDraftBtn");
const discardRecipeBtn = document.getElementById("discardRecipeBtn");
const cancelRecipeBtn = document.getElementById("cancelRecipeBtn");
const addTagBtn = document.getElementById("addTagBtn");
const creatorTagInput = document.getElementById("creatorTagInput");
const recipeTimeInput = document.getElementById("recipeTimeInput");
const calculateScalingBtn = document.getElementById("calculateScalingBtn");
const acceptSuggestionBtn = document.getElementById("acceptSuggestionBtn");

const initialTitleValue = document.querySelector(".recipe-basics input")?.value || "";
const initialDescriptionValue = document.querySelector(".recipe-basics textarea")?.value || "";
const initialTagsHtml = document.querySelector(".creator-tags")?.innerHTML || "";
const initialIngredientRowsHtml = ingredientRows?.innerHTML || "";
const initialStepRowsHtml = stepRows?.innerHTML || "";
let selectedImageData = "";

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

  selectedImageData = "";

  if (creatorHeroUpload) {
    creatorHeroUpload.style.background = "";
  }

  if (creatorHeroLabel) {
    creatorHeroLabel.dataset.previewState = "default";
  }

  if (recipeTimeInput) {
    recipeTimeInput.value = "45";
  }

  document.querySelectorAll(".nutrition-input").forEach((input) => {
    input.value = input.dataset.nutrition === "calories" ? "12" : input.dataset.nutrition === "protein" ? "4" : input.dataset.nutrition === "carbs" ? "12" : "8";
  });

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
  .map((tag) => tag.dataset.tag || tag.textContent.replace(/x\s*$/i, "").trim())
  .filter(Boolean);

const collectNutrition = () => {
  const cards = Array.from(document.querySelectorAll(".nutrition-editor-grid article"));
  const keys = ["calories", "protein", "carbs", "fat"];

  return keys.reduce((nutrition, key, index) => {
    const valueText = cards[index]?.querySelector(".nutrition-input")?.value || "0";
    nutrition[key] = parseNumber(valueText, 0);
    return nutrition;
  }, {});
};

const collectRecipePayload = async () => {
  const title = document.querySelector(".recipe-basics input")?.value.trim() || "";
  const description = document.querySelector(".recipe-basics textarea")?.value.trim() || "";
  const timeText = recipeTimeInput?.value || "0";
  const imageFile = creatorImageInput?.files?.[0] || null;
  let image = selectedImageData;

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
    selectedImageData = "";
    setHeroBackground("");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedImageData = String(reader.result || "");
    setHeroBackground(selectedImageData);
  };
  reader.onerror = () => {
    selectedImageData = "";
    setHeroBackground("");
  };
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

    resetCreateRecipePage();
    setStatus("Recipe submitted for admin approval.", "success");
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

    if (recipeTimeInput && draft.timeMinutes !== undefined) {
      recipeTimeInput.value = String(draft.timeMinutes);
    }

    document.querySelectorAll(".nutrition-input").forEach((input) => {
      const value = draft.nutrition?.[input.dataset.nutrition];
      if (value !== undefined) input.value = String(value);
    });

    if (Array.isArray(draft.dietaryTags)) {
      document.querySelectorAll(".creator-tags span").forEach((tag) => tag.remove());
      draft.dietaryTags.forEach((tag) => addTag(String(tag)));
    }

    if (Array.isArray(draft.ingredients) && ingredientRows) {
      ingredientRows.innerHTML = "";
      draft.ingredients.forEach((ingredient) => addIngredientRow(ingredient));
    }

    if (Array.isArray(draft.steps) && stepRows && addStepBtn) {
      stepRows.querySelectorAll("article").forEach((row) => row.remove());
      draft.steps.forEach((step, index) => addStepRow(step, index + 1));
    }

    if (draft.image) {
      selectedImageData = draft.image;
      setHeroBackground(draft.image);
    }
  } catch (error) {
    console.debug("Draft restore failed:", error);
  }
};

const addIngredientRow = (ingredient = {}) => {
  if (!ingredientRows) return;
  const row = document.createElement("div");
  row.className = "ingredient-editor-row";
  row.innerHTML = `
      <i data-lucide="grip-vertical"></i>
      <input placeholder="Qty" value="${ingredient.quantity || ""}" />
      <input placeholder="Unit" value="${ingredient.unit || ""}" />
      <input placeholder="Ingredient name" value="${ingredient.name || ""}" />
    `;
  ingredientRows.appendChild(row);
  if (window.lucide) lucide.createIcons();
};

if (addIngredientBtn) addIngredientBtn.addEventListener("click", () => addIngredientRow());

const addStepRow = (value = "", stepNumber = getStepRows().length + 1) => {
  if (!stepRows || !addStepBtn) return;
  const article = document.createElement("article");
  article.innerHTML = `
      <span>${stepNumber}</span>
      <textarea placeholder="Describe the next preparation step...">${value}</textarea>
    `;
  stepRows.insertBefore(article, addStepBtn);
};

if (addStepBtn) addStepBtn.addEventListener("click", () => addStepRow());

const headerSubmitBtn = document.getElementById("submitForApprovalBtnHeader");
const footerSubmitBtn = document.getElementById("submitForApprovalBtn");

if (headerSubmitBtn) headerSubmitBtn.addEventListener("click", submitForApproval);
if (footerSubmitBtn) footerSubmitBtn.addEventListener("click", submitForApproval);
if (saveDraftBtn) saveDraftBtn.addEventListener("click", saveDraft);

const removeTag = (event) => {
  const button = event.target.closest("button");
  if (button) button.closest("span")?.remove();
};

document.querySelector(".creator-tags")?.addEventListener("click", (event) => {
  if (event.target.closest("span")) removeTag(event);
});

const addTag = (value) => {
  const tag = String(value || "").trim();
  const tagsContainer = document.querySelector(".creator-tags");
  if (!tag || !tagsContainer || collectTags().some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
  const tagElement = document.createElement("span");
  tagElement.dataset.tag = tag;
  tagElement.innerHTML = `${tag} <button type="button" aria-label="Remove ${tag} tag">x</button>`;
  tagsContainer.insertBefore(tagElement, creatorTagInput || addTagBtn);
};

if (addTagBtn) addTagBtn.addEventListener("click", () => {
  addTag(creatorTagInput?.value);
  if (creatorTagInput) creatorTagInput.value = "";
});

if (creatorTagInput) creatorTagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTagBtn?.click();
  }
});

const resetWithConfirmation = () => {
  if (window.confirm("Discard this recipe draft?")) resetCreateRecipePage();
};

if (discardRecipeBtn) discardRecipeBtn.addEventListener("click", resetWithConfirmation);
if (cancelRecipeBtn) cancelRecipeBtn.addEventListener("click", resetWithConfirmation);

if (calculateScalingBtn) calculateScalingBtn.addEventListener("click", () => {
  const servings = window.prompt("How many servings should this recipe make?", "100");
  const count = parseNumber(servings, 0);
  if (count > 0) setStatus(`Scaling estimate ready for ${count} servings.`, "success");
});

if (acceptSuggestionBtn) acceptSuggestionBtn.addEventListener("click", () => {
  const ingredient = { quantity: "1", unit: "tsp", name: "Lemon zest" };
  if (!collectIngredients().some((item) => item.name.toLowerCase() === ingredient.name.toLowerCase())) addIngredientRow(ingredient);
  setStatus("Lemon zest added to the ingredient list.", "success");
});

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

if (creatorImageInput) {
  creatorImageInput.addEventListener("change", () => {
    updateHeroPreviewFromFile(creatorImageInput.files?.[0] || null);
  });
}

setHeroBackground("");
restoreDraft();
