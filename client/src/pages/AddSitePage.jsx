import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_ORIGIN } from '../api/client';

export default function AddSitePage({ onSiteCreated }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdSite, setCreatedSite] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await api.createSite(name, domain);
      setCreatedSite(data.site);
      onSiteCreated?.(data.site);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const snippet = createdSite
    ? `<script src="${API_ORIGIN}/tracker.js" data-site="${createdSite.tracking_id}" defer></script>`
    : '';

  function copySnippet() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (createdSite) {
    return (
      <div className="page-content narrow">
        <h1 className="page-title">Add this to {createdSite.domain}</h1>
        <p className="page-subtitle">
          Paste this snippet in the <code className="mono">&lt;head&gt;</code> of every page you want
          to track.
        </p>

        <div className="snippet-box">
          <code className="mono">{snippet}</code>
          <button className="btn btn-secondary snippet-copy" onClick={copySnippet}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="panel">
          <h3>Track a button or link click</h3>
          <p className="text-muted">
            Add a <code className="mono">data-track</code> attribute to any element:
          </p>
          <div className="snippet-box small">
            <code className="mono">{'<button data-track="signup_button">Sign up</button>'}</code>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => navigate(`/sites/${createdSite.id}`)}>
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="page-content narrow">
      <h1 className="page-title">Add a site</h1>
      <p className="page-subtitle">Give it a name and the domain you'll be tracking.</p>

      <form onSubmit={handleSubmit} className="stacked-form">
        <label className="field">
          <span className="field-label">Site name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Blog"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Domain</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            required
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create site'}
        </button>
      </form>
    </div>
  );
}
