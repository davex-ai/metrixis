import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { AuthService, protect } from "trustlyx";
import { sdk, connectMongo } from "./sdk.js";

const app = express();
app.use(cors({ origin: process.env.APP_URL, credentials: true }));
app.use(express.json());

// Basic brute-force throttle on auth endpoints, on top of trustlyx's
// own per-account lockout tracking.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// --- Register ---
app.post("/auth/signup", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  console.log(`[auth-service] POST /auth/signup email=${email}`);
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }
  try {
    const ctx = sdk.createContext(req);
    const auth = new AuthService(ctx);
    const user = await auth.signup(email, password);
    console.log(`[auth-service] signup succeeded, userId=${user.id}`);
    res.status(201).json({
      message: "Account created. Check your email to verify before logging in.",
      userId: user.id,
    });
  } catch (err) {
    console.error(`[auth-service] signup FAILED for ${email}:`, err.message);
    res.status(400).json({ message: err.message });
  }
});

// --- Verify email ---
// trustlyx builds the link as `${appUrl}/verify-email/:token` (see AuthService.signup).
// The dashboard's /verify-email/:token page should call this endpoint on mount.
app.post("/auth/verify-email", async (req, res) => {
  const { token } = req.body;
  console.log(`[auth-service] POST /auth/verify-email`);
  if (!token) {
    return res.status(400).json({ message: "token is required" });
  }
  try {
    const ctx = sdk.createContext(req);
    const auth = new AuthService(ctx);
    const result = await auth.verifyEmail(token);
    console.log(`[auth-service] verify-email succeeded`);
    res.json(result);
  } catch (err) {
    console.error(`[auth-service] verify-email FAILED:`, err.message);
    res.status(400).json({ message: err.message });
  }
});

// --- Login ---
app.post("/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  console.log(`[auth-service] POST /auth/login email=${email}`);
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }
  try {
    const ctx = sdk.createContext(req);
    const auth = new AuthService(ctx);
    // AuthService.login already handles lockout checking, failed-attempt
    // recording, and the "Verify your email" case internally — no need to
    // duplicate that logic here.
    const tokens = await auth.login(email, password);
    console.log(`[auth-service] login succeeded for ${email}`);
    res.json(tokens);
  } catch (err) {
    console.error(`[auth-service] login FAILED for ${email}:`, err.message);
    const status = err.message === "Too many failed attempts. Try again later." ? 429 : 401;
    res.status(status).json({ message: err.message });
  }
});

// --- Refresh ---
app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "refreshToken is required" });
  }
  try {
    const ctx = sdk.createContext(req);
    const auth = new AuthService(ctx);
    const tokens = await auth.refresh(refreshToken);
    res.json(tokens);
  } catch (err) {
    console.error(`[auth-service] refresh FAILED:`, err.message);
    res.status(401).json({ message: err.message });
  }
});

// Returns the decoded JWT claims for the caller. The Python backend
// independently verifies tokens using the shared JWT_SECRET — this
// endpoint is a convenience for the frontend to check "am I logged in".
app.get("/auth/me", protect(sdk), (req, res) => {
  res.json({ user: req.user });
});

const PORT = process.env.PORT || 4000;

connectMongo()
  .then(() => {
    app.listen(PORT, () => console.log(`[auth-service] listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("[auth-service] failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
