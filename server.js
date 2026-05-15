const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
require("dotenv").config();

const { getRecipes } = require("./lib/recipes");
const { pingMongo } = require("./lib/mongodb");
const { signToken, verifyToken } = require("./lib/auth");
const { upsertGoogleUser, findUserByEmail, upsertLocalUser, verifyPassword, hashPassword, recordLogin } = require("./lib/users");
const https = require("https");
const querystring = require("querystring");
const crypto = require("crypto");

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

  /* ---------- AUTH: Google OAuth start ---------- */
  if (requestPath === "/api/auth/google" && req.method === "GET") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    let callback = process.env.GOOGLE_CALLBACK_URL;

    if (!clientId) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Google OAuth not configured");
      return;
    }

    // If callback not explicitly set, construct from request
    if (!callback) {
      const host = req.headers.host || "localhost";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      callback = `${protocol}://${host}/api/auth/google/callback`;
    }

    const state = crypto.randomBytes(16).toString("hex");
    // set a short-lived state cookie
    res.setHeader("Set-Cookie", `oauth_state=${state}; HttpOnly; Path=/; Max-Age=600`);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state
    });

    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  if (requestPath === "/api/auth/google/callback" && req.method === "GET") {
    (async () => {
      try {
        const params = requestUrl.searchParams;
        const code = params.get("code");
        const state = params.get("state");

        const cookies = (req.headers.cookie || "").split(";").map(c => c.trim()).reduce((acc, cur) => {
          const [k,v] = cur.split("="); if (!k) return acc; acc[k] = v; return acc;
        }, {});

        if (!code || !state || cookies.oauth_state !== state) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid OAuth callback");
          return;
        }

        let callback = process.env.GOOGLE_CALLBACK_URL;
        if (!callback) {
          const host = req.headers.host || "localhost";
          const protocol = req.headers["x-forwarded-proto"] || "http";
          callback = `${protocol}://${host}/api/auth/google/callback`;
        }

        const tokenRes = await new Promise((resolve, reject) => {
          const postData = querystring.stringify({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: callback,
            grant_type: "authorization_code"
          });

          const options = new URL("https://oauth2.googleapis.com/token");
          const reqPost = https.request(options, (r) => {
            let data = "";
            r.on("data", d => data += d);
            r.on("end", () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
          });

          reqPost.on("error", reject);
          reqPost.setHeader("Content-Type", "application/x-www-form-urlencoded");
          reqPost.write(postData);
          reqPost.end();
        });

        const accessToken = tokenRes.access_token;

        let profile = null;

        if (accessToken) {
          profile = await new Promise((resolve) => {
            https.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`, (r) => {
              let data = "";
              r.on("data", d => data += d);
              r.on("end", () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
              });
            }).on('error', () => resolve(null));
          });
        }

        if (!profile) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Failed to fetch Google profile");
          return;
        }

        // attempt to persist user; if Mongo unavailable, ignore error
        try {
          await upsertGoogleUser({
            googleId: profile.id,
            googleEmail: profile.email,
            displayName: profile.name,
            avatarUrl: profile.picture
          });
        } catch (err) {
          console.debug("Could not persist Google user (no Mongo?):", err && err.message);
        }

        const token = signToken({ sub: profile.id, email: profile.email, name: profile.name, avatar: profile.picture });

        // set auth cookie and clear oauth_state
        res.setHeader("Set-Cookie", [
          `auth=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
          `oauth_state=; HttpOnly; Path=/; Max-Age=0`
        ]);

        res.writeHead(302, { Location: "/" });
        res.end();

      } catch (err) {
        console.error("OAuth callback error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("OAuth callback failed");
      }
    })();

    return;
  }

  if (requestPath === "/api/auth/me" && req.method === "GET") {
    const cookies = (req.headers.cookie || "").split(";").map(c => c.trim()).reduce((acc, cur) => {
      const [k,v] = cur.split("="); if (!k) return acc; acc[k] = v; return acc;
    }, {});

    const token = cookies.auth;
    if (!token) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_authenticated" }));
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_token" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ email: payload.email, displayName: payload.name, avatar: payload.avatar }));
    return;
  }

  if (requestPath === "/api/auth/logout" && req.method === "GET") {
    res.setHeader("Set-Cookie", `auth=; HttpOnly; Path=/; Max-Age=0`);
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }

  /* ---------- AUTH: Manual Login/Signup ---------- */
  if (requestPath === "/api/auth/signup" && req.method === "POST") {
    (async () => {
      try {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
          try {
            const { email, password, displayName } = JSON.parse(body || "{}");

            if (!email || !password) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "email and password required" }));
              return;
            }

            // Check if user exists
            const existing = await findUserByEmail(email);
            if (existing) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "user_exists" }));
              return;
            }

            // Hash password and create user
            const passwordHash = await hashPassword(password);
            const user = await upsertLocalUser({
              email,
              passwordHash,
              displayName: displayName || email.split("@")[0]
            });

            // Create token
            const token = signToken({ sub: user._id.toString(), email: user.email, name: user.displayName });

            // Set cookie
            res.setHeader("Set-Cookie", `auth=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              email: user.email,
              displayName: user.displayName
            }));
          } catch (err) {
            console.error("Signup error:", err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "signup_failed" }));
          }
        });
      } catch (err) {
        console.error("Signup error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "signup_failed" }));
      }
    })();
    return;
  }

  if (requestPath === "/api/auth/login" && req.method === "POST") {
    (async () => {
      try {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
          try {
            const { email, password } = JSON.parse(body || "{}");

            if (!email || !password) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "email and password required" }));
              return;
            }

            // Find user
            const user = await findUserByEmail(email);
            if (!user) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "invalid_credentials" }));
              return;
            }

            // Verify password
            const passwordValid = await verifyPassword(password, user.passwordHash);
            if (!passwordValid) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "invalid_credentials" }));
              return;
            }

            // Record login
            await recordLogin(user._id);

            // Create token
            const token = signToken({ sub: user._id.toString(), email: user.email, name: user.displayName });

            // Set cookie
            res.setHeader("Set-Cookie", `auth=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              email: user.email,
              displayName: user.displayName
            }));
          } catch (err) {
            console.error("Login error:", err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "login_failed" }));
          }
        });
      } catch (err) {
        console.error("Login error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "login_failed" }));
      }
    })();
    return;
  }

  /* ---------- AUTH: Manual Login/Signup end ---------- */

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
