const RENDER_BACKEND_URL =
  process.env.RENDER_BACKEND_URL ||
  "https://smartrecipegenerator-rbkj.onrender.com";

module.exports = async function handler(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const response = await fetch(`${RENDER_BACKEND_URL}/health`, {
      cache: "no-store"
    });

    res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      status: response.status,
      target: RENDER_BACKEND_URL
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: "Render health ping failed",
      target: RENDER_BACKEND_URL
    });
  }
};
