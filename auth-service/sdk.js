import "dotenv/config";
import mongoose from "mongoose";
import Redis from "ioredis";
import { AuthSDK, RedisAdapter, MongooseUserAdapter, SmtpAdapter, MockEmailAdapter } from "trustlyx";

// --- Mongo connection ---
// MongooseUserAdapter registers its own User model on the default mongoose
// connection (trustlyx/dist: mongoose.model("User", userSchema)) — we just
// need to connect before any adapter method runs.
export async function connectMongo() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[auth-service] connected to MongoDB");
}

// --- Redis client for the cache adapter (failed-login lockout tracking) ---
const redisClient = new Redis(process.env.REDIS_URL);
redisClient.on("error", (err) => console.error("[auth-service] Redis error:", err.message));

// --- Email adapter ---
// Real Gmail SMTP if configured, otherwise trustlyx's own MockEmailAdapter
// (just console.logs the email — useful for local dev without touching Gmail).
const gmailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

const baseEmailAdapter = gmailConfigured
  ? new SmtpAdapter({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password, not your normal password
      },
      from: `Metrixis <${process.env.GMAIL_USER}>`,
    })
  : new MockEmailAdapter();

if (!gmailConfigured) {
  console.log(
    "[auth-service:email] GMAIL_USER / GMAIL_APP_PASSWORD not set — using MockEmailAdapter, emails only print to console"
  );
} else {
  console.log(`[auth-service:email] SmtpAdapter configured for ${process.env.GMAIL_USER}`);
}

// Wrap the chosen adapter with logging so send attempts (and failures) are
// always visible, regardless of which underlying adapter is active.
const emailAdapter = {
  async sendEmail(to, subject, html) {
    console.log(`[auth-service:email] >>> sending: to=${to} subject="${subject}"`);
    try {
      await baseEmailAdapter.sendEmail(to, subject, html);
      console.log(`[auth-service:email] <<< sent OK to=${to}`);
    } catch (err) {
      console.error(`[auth-service:email] <<< FAILED to=${to}:`, err.message);
      throw err;
    }
  },
};

// Metrixis is a single-tenant deployment at the auth layer: every signed-up
// person is a row in the same Mongo user collection. Per-account isolation
// of *analytics data* (sites, events) is handled downstream in the Python
// backend, keyed off the user's id from the JWT. trustlyx still requires a
// tenant resolver, so we return a constant.
const TENANT_ID = "metrixis";

export const sdk = new AuthSDK({
  jwtSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.REFRESH_SECRET,
  appUrl: process.env.APP_URL,
  adapters: {
    email: emailAdapter,
    cache: new RedisAdapter(redisClient),
  },
  userAdapter: new MongooseUserAdapter(),
  getTenant: () => TENANT_ID,
  providers: process.env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          redirectUri: process.env.GOOGLE_REDIRECT_URI,
        },
      }
    : undefined,
});

export { TENANT_ID };
