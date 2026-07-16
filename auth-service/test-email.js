/**
 * Isolated SMTP test — bypasses trustlyx's auth flow, Mongo, and Redis
 * entirely. Run: node test-email.js you@example.com
 *
 * Tells us definitively whether a problem is (a) Gmail credentials/App
 * Password, or (b) something in the signup/verification flow.
 */
import "dotenv/config";
import { SmtpAdapter } from "trustlyx";

const to = process.argv[2];
if (!to) {
  console.error("Usage: node test-email.js <recipient-email>");
  process.exit(1);
}

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env");
  process.exit(1);
}

console.log(`Sending test email from ${process.env.GMAIL_USER} to ${to}...`);

const adapter = new SmtpAdapter({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  from: `Metrixis Test <${process.env.GMAIL_USER}>`,
});

try {
  await adapter.sendEmail(to, "Metrixis SMTP test", "<p>If you got this, Gmail SMTP is working.</p>");
  console.log("SUCCESS — check the inbox (and spam folder).");
} catch (err) {
  console.error("FAILED:", err.message);
  console.error(err);
  process.exit(1);
}
