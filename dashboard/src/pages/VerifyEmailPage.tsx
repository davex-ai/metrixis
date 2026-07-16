import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const AUTH_API = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:4000";

type Status = "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    fetch(`${AUTH_API}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Verification failed");
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-panel border border-line rounded-lg p-6 text-center">
        <h1 className="font-display text-lg font-semibold text-paper mb-3">metrixis</h1>
        {status === "verifying" && <p className="text-sm text-muted font-body">Verifying your email…</p>}
        {status === "success" && (
          <>
            <p className="text-sm text-signal font-body mb-4">Email verified — you can sign in now.</p>
            <Link to="/login" className="text-signal text-sm hover:underline">
              Go to sign in
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm text-danger font-body mb-4">{message}</p>
            <Link to="/login" className="text-signal text-sm hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
