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
