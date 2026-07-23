import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import StatStrip from '../components/StatStrip';
import VisitsChart from '../components/VisitsChart';
import RankedList from '../components/RankedList';
import ScrollFunnel from '../components/ScrollFunnel';
import RangeSelector from '../components/RangeSelector';

export default function SiteDashboardPage({ sites }) {
  const { siteId } = useParams();
  const site = sites.find((s) => String(s.id) === siteId);

  const [range, setRange] = useState('30d');
  const [overview, setOverview] = useState(null);
  const [pages, setPages] = useState([]);
  const [clicks, setClicks] = useState([]);
  const [scroll, setScroll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      api.overview(siteId, range),
      api.topPages(siteId, range),
      api.topClicks(siteId, range),
      api.scrollDepth(siteId, range),
    ])
      .then(([overviewRes, pagesRes, clicksRes, scrollRes]) => {
        if (cancelled) return;
        setOverview(overviewRes);
        setPages(pagesRes.pages);
        setClicks(clicksRes.clicks);
        setScroll(scrollRes.scroll);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siteId, range]);

  if (!site) {
    return <div className="page-content">Site not found.</div>;
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">{site.name}</h1>
          <p className="page-subtitle">{site.domain}</p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {error && <div className="auth-error">{error}</div>}

      {loading && !overview ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          <StatStrip totals={overview?.totals} />

          <div className="panel">
            <h3 className="panel-title">Traffic over time</h3>
            <VisitsChart series={overview?.series} />
          </div>

          <div className="two-col">
            <RankedList
              title="Top pages"
              items={pages}
              labelKey="page_url"
              valueKey="pageviews"
              emptyText="No pageviews recorded yet in this range."
            />
            <RankedList
              title="Top clicks"
              items={clicks}
              labelKey="track_label"
              valueKey="clicks"
              emptyText="No tracked clicks yet. Add data-track attributes to your buttons and links."
            />
          </div>

          <ScrollFunnel scroll={scroll} />
        </>
      )}
    </div>
  );
}
