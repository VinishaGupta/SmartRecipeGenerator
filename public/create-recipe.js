const addIngredientBtn = document.getElementById("addIngredientBtn");
const ingredientRows = document.getElementById("ingredientRows");
const addStepBtn = document.getElementById("addStepBtn");
const stepRows = document.getElementById("stepRows");

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
  lucide.createIcons();
});

addStepBtn.addEventListener("click", () => {
  const stepNumber = stepRows.querySelectorAll("article").length + 1;
  const article = document.createElement("article");
  article.innerHTML = `
    <span>${stepNumber}</span>
    <textarea placeholder="Describe the next preparation step..."></textarea>
  `;
  stepRows.insertBefore(article, addStepBtn);
});
