import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/sites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-paper tracking-tight">metrixis</h1>
          <p className="text-sm text-muted font-body mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-panel border border-line rounded-lg p-6 flex flex-col gap-4">
          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 font-body">
              {error}
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-muted font-body">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-ink border border-line rounded px-3 py-2 text-sm text-paper font-body focus:outline-none focus:ring-2 focus:ring-signal/40"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-muted font-body">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-ink border border-line rounded px-3 py-2 text-sm text-paper font-body focus:outline-none focus:ring-2 focus:ring-signal/40"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-signal text-ink font-body font-semibold text-sm rounded px-4 py-2.5 hover:bg-signal/90 transition disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-muted font-body mt-4">
          No account?{" "}
          <Link to="/signup" className="text-signal hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
