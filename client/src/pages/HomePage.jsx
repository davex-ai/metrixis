import { Navigate } from 'react-router-dom';

export default function HomePage({ sites }) {
  if (sites.length > 0) {
    return <Navigate to={`/sites/${sites[0].id}`} replace />;
  }

  return (
    <div className="page-content narrow">
      <h1 className="page-title">Welcome to Metrixis</h1>
      <p className="page-subtitle">
        Add your first site to start tracking pageviews, clicks, and scroll depth.
      </p>
      <a href="/sites/new" className="btn btn-primary">
        Add a site
      </a>
    </div>
  );
}
