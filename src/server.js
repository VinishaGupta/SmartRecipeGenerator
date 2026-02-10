const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

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
  // -------------------- RECIPES API --------------------
  if (req.url === "/api/recipes") {
    readFileSafely(DATA_PATH, res);
    return;
  }

  // -------------------- IMAGE RECOGNITION (LOCAL AI) --------------------
  if (req.url === "/api/recognize" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));

    req.on("end", () => {
      try {
        const { imageBase64 } = JSON.parse(body || "{}");

        if (!imageBase64) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Image payload missing." }));
          return;
        }

        // Decode base64 image
        const base64Data = imageBase64.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");

        // Save temp image
        const tempImagePath = path.join(
          os.tmpdir(),
          `vision_${Date.now()}.png`
        );
        fs.writeFileSync(tempImagePath, buffer);

        // Call Python vision script
        execFile(
          "python",
          [path.join(__dirname, "..", "vision", "recognize.py"), tempImagePath],
          (error, stdout, stderr) => {
            fs.unlinkSync(tempImagePath);

            if (error) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "Local vision processing failed.",
                  details: stderr || error.message
                })
              );
              return;
            }

            const labels = JSON.parse(stdout);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                predictions: labels.map((label) => ({ label }))
              })
            );
          }
        );
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Failed to process image.",
            message: err.message
          })
        );
      }
    });

    return;
  }

  // -------------------- STATIC FILES --------------------
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(ROOT, requestPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }

  readFileSafely(filePath, res);
});

// -------------------- SERVER START --------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Smart Recipe Generator running on http://localhost:${PORT}`);
});
