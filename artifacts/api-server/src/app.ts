import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();
app.disable("x-powered-by");

// Behind a reverse proxy (Render), set TRUST_PROXY (e.g. "1" = one hop) so
// req.ip is the real client — the rate limiters key on it. Leave unset when
// the API is reached directly, or clients could spoof X-Forwarded-For.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

// Browser origins allowed to call the API with cookies. CORS_ORIGINS is a
// comma-separated list (e.g. the frontend's URL); unset = localhost only.
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.length > 0
    ? allowedOrigins.includes(origin)
    : LOCAL_ORIGIN.test(origin);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
  }),
);
// Security headers for every response (API and the SPA shell). The CSP allows
// inline styles (React style props) and Google Fonts; scripts only from here.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
app.use((_req, res, next) => {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(cookieParser());
// Avatars are sent inline as data URLs, so the profile route accepts larger bodies.
app.use("/api/profile", express.json({ limit: "300kb" }));
app.use(express.json());
app.use(authMiddleware);

app.use("/api", router);

// Single-service deploy: when the forum has been built, serve it from this same
// origin (so no CORS / cross-site cookie setup is needed). The bundle runs from
// artifacts/api-server/dist, so the default resolves to artifacts/forum/dist/public.
const frontendDir =
  process.env.FRONTEND_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../forum/dist/public");
const indexHtml = path.join(frontendDir, "index.html");

if (fs.existsSync(indexHtml)) {
  app.use(
    express.static(frontendDir, {
      index: false,
      setHeaders(res, filePath) {
        // Vite fingerprints everything under /assets, so it can be cached forever.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  // Client-side routes (/post/5, /admin, ...) all load the SPA shell.
  app.use((req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
  logger.info({ frontendDir }, "Serving frontend");
}

export default app;
