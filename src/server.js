const http = require("http");
const fs = require("fs");
const path = require("path");

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
  if (req.url === "/api/recipes") {
    readFileSafely(DATA_PATH, res);
    return;
  }

  if (req.url === "/api/recognize" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const { imageBase64 } = JSON.parse(body || "{}");
        if (!imageBase64) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Image payload missing." }));
          return;
        }

        const token = process.env.HF_TOKEN;
        if (!token) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "HF_TOKEN is not set. Provide a Hugging Face token."
            })
          );
          return;
        }

        const base64Data = imageBase64.split(",").pop();
        const buffer = Buffer.from(base64Data, "base64");
        const response = await fetch(
          "https://api-inference.huggingface.co/models/nateraw/food",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/octet-stream"
            },
            body: buffer
          }
        );

        if (!response.ok) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Vision model request failed.",
              status: response.status
            })
          );
          return;
        }

        const predictions = await response.json();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ predictions }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Failed to process image.",
            message: error.message
          })
        );
      }
    });
    return;
  }

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
