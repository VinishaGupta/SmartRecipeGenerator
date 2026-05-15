const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
require("dotenv").config();

const { getRecipes } = require("./lib/recipes");
const { pingMongo } = require("./lib/mongodb");

const ROOT = path.join(__dirname, "public");

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

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function pingMongoIfConnected() {
  await pingMongo();
}

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
  setCorsHeaders(res);
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requestPath = requestUrl.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  /* ---------- HEALTH CHECK ---------- */
  if (requestPath === "/health" && req.method === "GET") {
    (async () => {
      try {
        // This route is meant for external uptime monitors such as
        // UptimeRobot or Cron-job.org. Those services can call /health
        // periodically to reduce cold starts on Render.
        await pingMongoIfConnected();

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      } catch (error) {
        console.error("Health check failed:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Health check failed" }));
      }
    })();
    return;
  }

  /* ---------- RECIPES ---------- */
  if (requestPath === "/api/recipes" && req.method === "GET") {
    (async () => {
      try {
        const recipes = await getRecipes();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(recipes));
      } catch (error) {
        console.error("Failed to load recipes:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to load recipes" }));
      }
    })();
    return;
  }

  /* ---------- IMAGE RECOGNITION ---------- */
  if (requestPath === "/api/recognize" && req.method === "POST") {
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
              res.end(JSON.stringify({ predictions: [] }));
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
  let reqPath = requestPath;

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

const HOST = "0.0.0.0";
const DEFAULT_PORT = Number(process.env.PORT) || 3000;

function startServer(port) {
  server.listen(port, HOST, () => {
    const address = server.address();
    console.log(`Server running at http://localhost:${address.port}`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && !process.env.PORT) {
    const nextPort = Number(error.port) + 1;
    console.log(`Port ${error.port} is busy. Trying ${nextPort}...`);
    startServer(nextPort);
    return;
  }

  throw error;
});

startServer(DEFAULT_PORT);
