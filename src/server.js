const path = require("path");
const http = require("http");
const fs = require("fs");

// Load .env (ONE level above src/)
require("dotenv").config({
  path: path.join(__dirname, "..", ".env")
});

console.log("GOOGLE_VISION_KEY loaded:", !!process.env.GOOGLE_VISION_KEY);

// node-fetch for Google Vision REST API
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const ROOT = path.join(__dirname, "..", "public");
const DATA_PATH = path.join(__dirname, "..", "data", "recipes.json");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const readFileSafely = (filePath, res) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "text/plain" });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  // Serve recipes
  if (req.url === "/api/recipes") {
    readFileSafely(DATA_PATH, res);
    return;
  }

  // 🔥 REAL IMAGE RECOGNITION USING GOOGLE VISION
  if (req.url === "/api/recognize" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));

    req.on("end", async () => {
      try {
        const { imageBase64 } = JSON.parse(body || "{}");

        if (!imageBase64) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Image payload missing" }));
          return;
        }

        if (!process.env.GOOGLE_VISION_KEY) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Google Vision API key not set" }));
          return;
        }

        const base64Image = imageBase64.split(",")[1];

        const visionResponse = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [
                {
                  image: { content: base64Image },
                  features: [{ type: "LABEL_DETECTION", maxResults: 10 }]
                }
              ]
            })
          }
        );

        const result = await visionResponse.json();
        const labels =
          result.responses?.[0]?.labelAnnotations || [];

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            predictions: labels.map((l) => ({ label: l.description }))
          })
        );
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Vision processing failed",
            details: err.message
          })
        );
      }
    });

    return;
  }

  // Serve static files
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(ROOT, requestPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }

  readFileSafely(filePath, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Smart Recipe Generator running on http://localhost:${PORT}`);
});
