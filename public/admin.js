const RENDER_BACKEND_URL = "https://smartrecipegenerator-rbkj.onrender.com";

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

const submissionList = document.getElementById("submissionList");
const adminStatus = document.getElementById("adminStatus");
const pendingCount = document.getElementById("pendingCount");
const refreshQueueBtn = document.getElementById("refreshQueueBtn");

const setStatus = (message) => {
  if (adminStatus) {
    adminStatus.textContent = message;
  }
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const getCurrentUser = async () => {
  try {
    const response = await fetch(apiUrl("/api/auth/me"), { credentials: "same-origin" });
    if (!response.ok) return null;
    return await parseJsonSafely(response);
  } catch (error) {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const ADMIN_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Crect width='1280' height='720' fill='%23eef3f9'/%3E%3Ccircle cx='260' cy='190' r='72' fill='%23c7d2e2'/%3E%3Cpath d='M118 562l176-190c28-30 76-31 106-2l92 86 160-176c30-32 81-31 110 2l206 225c42 46 10 121-52 121H170c-69 0-106-82-52-116z' fill='%23d6deea'/%3E%3C/svg%3E";

const getSubmissionImageUrl = (submission) => {
  const imageValue = String(submission?.imageUrl || submission?.image || "").trim();

  if (!imageValue) {
    return ADMIN_IMAGE_PLACEHOLDER;
  }

  if (/^https?:\/\//i.test(imageValue) || /^data:/i.test(imageValue)) {
    return imageValue;
  }

  const cloudinaryPublicId = encodeURIComponent(imageValue).replace(/%2F/g, "/");
  return `https://res.cloudinary.com/djsenbil3/image/upload/w_720,h_420,c_fill,q_auto,f_auto/${cloudinaryPublicId}`;
};

const renderSubmission = (submission) => {
  const ingredients = Array.isArray(submission.ingredients) ? submission.ingredients : [];
  const steps = Array.isArray(submission.steps) ? submission.steps : [];
  const tags = Array.isArray(submission.dietaryTags) ? submission.dietaryTags : [];
  const submissionImageUrl = getSubmissionImageUrl(submission);

  return `
    <article class="submission-card" data-submission-id="${submission.id}">
      <div class="submission-image-wrap">
        <img class="submission-image" src="${submissionImageUrl}" alt="${submission.name || "Submitted recipe"}" loading="lazy" onerror="this.onerror=null;this.src='${ADMIN_IMAGE_PLACEHOLDER}'" />
      </div>
      <div class="submission-top">
        <div>
          <h3>${submission.name || "Untitled recipe"}</h3>
          <p>${submission.description || "No description provided."}</p>
        </div>
        <div class="submission-meta">
          <div><strong>ID:</strong> ${submission.id}</div>
          <div><strong>Submitted:</strong> ${formatDate(submission.submittedAt)}</div>
          <div><strong>By:</strong> ${submission.submittedBy?.displayName || submission.submittedBy?.email || "Unknown"}</div>
        </div>
      </div>

      <div class="pill-row">
        <span class="pill">${submission.difficulty || "Easy"}</span>
        <span class="pill">${submission.timeMinutes || 0} min</span>
        <span class="pill">${submission.servings || 2} servings</span>
        ${tags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
      </div>

      <div class="submission-section">
        <h4>Ingredients</h4>
        <ul>${ingredients.map((ingredient) => `<li>${[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(" ")}</li>`).join("")}</ul>
      </div>

      <div class="submission-section">
        <h4>Steps</h4>
        <ol>${steps.map((step) => `<li>${step}</li>`).join("")}</ol>
      </div>

      <div class="submission-actions">
        <button class="btn btn-approve" type="button" data-action="approve">Approve</button>
        <button class="btn btn-reject" type="button" data-action="reject">Reject</button>
      </div>
    </article>
  `;
};

const approveSubmission = async (submissionId) => {
  const response = await fetch(apiUrl("/api/admin/recipe-submissions/approve"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ submissionId })
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.details || data?.error || "Approval failed");
  }
};

const rejectSubmission = async (submissionId) => {
  const reviewNote = window.prompt("Optional note for the submitter:", "");

  if (reviewNote === null) {
    return;
  }

  const response = await fetch(apiUrl("/api/admin/recipe-submissions/reject"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ submissionId, reviewNote })
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.details || data?.error || "Rejection failed");
  }
};

const loadQueue = async () => {
  setStatus("Loading submissions...");

  try {
    const response = await fetch(apiUrl("/api/admin/recipe-submissions"), {
      credentials: "same-origin"
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(data?.error || "Could not load moderation queue");
    }

    const submissions = Array.isArray(data?.submissions) ? data.submissions : [];
    pendingCount.textContent = String(submissions.length);

    if (!submissions.length) {
      submissionList.innerHTML = '<p class="empty-state">No pending submissions right now.</p>';
      setStatus("Queue is clear.");
      return;
    }

    submissionList.innerHTML = submissions.map(renderSubmission).join("");
    setStatus(`Loaded ${submissions.length} pending submission${submissions.length === 1 ? "" : "s"}.`);

    submissionList.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-submission-id]");
        const submissionId = card?.dataset.submissionId;

        if (!submissionId) {
          return;
        }

        button.disabled = true;

        try {
          if (button.dataset.action === "approve") {
            await approveSubmission(submissionId);
          } else {
            await rejectSubmission(submissionId);
          }

          await loadQueue();
        } catch (error) {
          setStatus(error.message || "Action failed");
        } finally {
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    submissionList.innerHTML = '<p class="error-state">Could not load submissions.</p>';
    setStatus(error.message || "Could not load submissions.");
  }
};

const initAdminPage = async () => {
  try {
    const res = await fetch(apiUrl('/api/is-admin'), { credentials: 'same-origin' });
    if (!res.ok) {
      submissionList.innerHTML = '<p class="access-state">Please sign in to access the moderation queue.</p>';
      setStatus('Sign in required.');
      return;
    }

    const data = await res.json();

    if (!data?.isAdmin) {
      submissionList.innerHTML = '<p class="access-state">Admin access required. Return to your <a href="profile.html">profile</a>.</p>';
      setStatus('Admin access required.');
      return;
    }

    await loadQueue();
  } catch (err) {
    submissionList.innerHTML = '<p class="access-state">Please sign in to access the moderation queue.</p>';
    setStatus('Sign in required.');
  }
};

if (refreshQueueBtn) {
  refreshQueueBtn.addEventListener("click", loadQueue);
}

initAdminPage();