import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";

const app: Express = express();

app.set("trust proxy", 1);

app.use(compression());

// General limiter: 5000 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Please try again later" },
  skip: (req) => req.path === "/health",
});

// Auth limiter: 500 per 15 minutes — handles 300-student burst registrations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts", message: "Please wait before trying again" },
});

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Cache headers for read-heavy routes
app.use("/api/announcements", (req, res, next) => {
  if (req.method === "GET") res.setHeader("Cache-Control", "private, max-age=30");
  next();
});

app.use("/api/hostels", (req, res, next) => {
  if (req.method === "GET") res.setHeader("Cache-Control", "private, max-age=60");
  next();
});

app.use("/api/auth", authLimiter);
app.use("/api", generalLimiter);
app.use("/api", router);

// Health check (no auth, no rate limit)
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found", message: "Route not found" });
});

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Error]", err?.message || err);
  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? "Internal Server Error" : err?.name || "Error",
    message: err?.message || "Something went wrong",
  });
});

export default app;
