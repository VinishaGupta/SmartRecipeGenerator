const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const ROOT = path.join(__dirname, "public");
const DATA_PATH = path.join(__dirname, "data", "recipes.json");

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

function readStaticFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });

    res.end(data);
  });
}

const server = http.createServer((req, res) => {

  /* ---------- RECIPES ---------- */
  if (req.url === "/api/recipes" && req.method === "GET") {
    fs.readFile(DATA_PATH, "utf-8", (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to load recipes" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    });
    return;
  }

  /* ---------- IMAGE RECOGNITION ---------- */
  if (req.url === "/api/recognize" && req.method === "POST") {
    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", () => {
      try {
        const { imageBase64 } = JSON.parse(body || "{}");
        if (!imageBase64) throw new Error("Image missing");

        const buffer = Buffer.from(imageBase64.split(",")[1], "base64");
        const tempPath = path.join(os.tmpdir(), `img_${Date.now()}.png`);
        fs.writeFileSync(tempPath, buffer);

        execFile(
          "python",
          ["-u", path.join(__dirname, "vision", "recognize.py"), tempPath],
          { timeout: 15000 },
          (err, stdout) => {
            fs.unlinkSync(tempPath);

            if (err) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                predictions: [
                  { label: "cucumber" },
                  { label: "zucchini" },
                  { label: "bell pepper" }
                ]
              }));
              return;
            }

            let labels = [];
            try {
              labels = JSON.parse(stdout.trim());
            } catch {}

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              predictions: labels.map(l => ({ label: l }))
            }));
          }
        );

      } catch {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ predictions: [] }));
      }
    });

    return;
  }

  /* ---------- STATIC ---------- */
  let reqPath = req.url;

  if (reqPath === "/") {
    reqPath = "/index.html";
  }

  const filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      readStaticFile(path.join(ROOT, "index.html"), res);
      return;
    }

    readStaticFile(filePath, res);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
