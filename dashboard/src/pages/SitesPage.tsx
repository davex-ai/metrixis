import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sitesApi, type Site } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function SitesPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    sitesApi
      .list()
      .then(setSites)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const site = await sitesApi.create({ name, domain });
      setSites((prev) => [site, ...prev]);
      setShowForm(false);
      setName("");
      setDomain("");
      navigate(`/sites/${site.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between mb-10">
        <h1 className="font-display text-xl font-semibold text-paper tracking-tight">metrixis</h1>
        <button
          onClick={logout}
          className="text-sm text-muted hover:text-paper font-body transition"
        >
          Sign out
        </button>
      </header>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-body font-semibold text-paper">Your sites</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-signal text-ink font-body font-semibold text-sm rounded px-4 py-2 hover:bg-signal/90 transition"
        >
          + Add site
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-panel border border-line rounded-lg p-5 mb-6 flex flex-col sm:flex-row gap-3 items-end"
        >
          <label className="flex flex-col gap-1.5 flex-1 w-full">
            <span className="text-xs uppercase tracking-wider text-muted font-body">Project name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My SaaS App"
              className="bg-ink border border-line rounded px-3 py-2 text-sm text-paper font-body focus:outline-none focus:ring-2 focus:ring-signal/40"
            />
          </label>
          <label className="flex flex-col gap-1.5 flex-1 w-full">
            <span className="text-xs uppercase tracking-wider text-muted font-body">Domain</span>
            <input
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="bg-ink border border-line rounded px-3 py-2 text-sm text-paper font-body focus:outline-none focus:ring-2 focus:ring-signal/40"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="bg-signal text-ink font-body font-semibold text-sm rounded px-4 py-2 hover:bg-signal/90 transition disabled:opacity-50 shrink-0"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted font-body">Loading…</p>
      ) : sites.length === 0 ? (
        <div className="bg-panel border border-line rounded-lg p-10 text-center">
          <p className="text-sm text-muted font-body">
            No sites yet. Add one to get a tracking snippet you can drop into your project.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {sites.map((site) => (
            <Link
              key={site.id}
              to={`/sites/${site.id}`}
              className="bg-panel border border-line rounded-lg p-5 hover:border-signal/50 transition group"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-body font-semibold text-paper group-hover:text-signal transition">
                  {site.name}
                </h3>
                <span className="w-2 h-2 rounded-full bg-signal" />
              </div>
              <p className="text-sm text-muted font-body mt-1">{site.domain}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
