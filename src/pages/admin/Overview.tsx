import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Loading } from '../../components/common';
import { adminApi, categoryApi, vocabularyApi } from '../../services';
import { PageHead, Unavailable, useLoad } from './shared';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AdminOverview() {
  const summary = useLoad(() => adminApi.summary());
  const visits = useLoad(() => {
    const to = new Date(), from = new Date(Date.now() - 13 * 864e5);
    return adminApi.visits(iso(from), iso(to), 'DAY');
  });
  // The catalogue health block reads learning-service directly, so it works even
  // before the analytics endpoints exist.
  const catalogue = useLoad(async () => {
    const [cats, vocab] = await Promise.all([categoryApi.list(0, 200), vocabularyApi.list(0, 1000)]);
    return { cats: cats.content, vocab: vocab.content };
  });

  const v = catalogue.data?.vocab ?? [];
  const noModel = v.filter(x => x.expectedId == null).length;
  const noVideo = v.filter(x => !x.videoTutorialUrl).length;
  const emptyCats = (catalogue.data?.cats ?? []).filter(c => !v.some(x => x.categoryId === c.id));
  const max = Math.max(1, ...(visits.data ?? []).map(p => p.count));

  return (
    <>
      <PageHead kicker="Admin · overview" title={<>The <em>back office</em>.</>} />

      {summary.data ? (
        <div className="tiles figs">
          <div className="fig"><b>{summary.data.totalStudents}</b><span>learners</span></div>
          <div className="fig"><b>{summary.data.totalVisits}</b><span>visits</span></div>
          <div className="fig"><b>{summary.data.totalVocabularies}</b><span>signs</span></div>
          <div className="fig"><b>{summary.data.totalBlogs}</b><span>posts</span></div>
        </div>
      ) : summary.loading ? <Loading /> : summary.missing ? <Unavailable endpoint="/api/admin/analytics/summary" service="identity / analytics" /> : <Alert>{summary.error}</Alert>}

      <div className="two-col">
        <div>
          <div className="rule-head"><h2>Visits · last 14 days</h2></div>
          {visits.data ? (
            visits.data.length ? (
              <>
                <div className="bars" role="img" aria-label="Daily visits">
                  {visits.data.map(p => <div key={p.label} className="bar" style={{ height: `${(p.count / max) * 100}%` }}><span>{p.count}</span></div>)}
                </div>
                <div className="bar-labels">{visits.data.map(p => <span key={p.label}>{p.label.slice(-5)}</span>)}</div>
              </>
            ) : <p className="muted">No visits recorded in this range.</p>
          ) : visits.loading ? <Loading /> : visits.missing ? <Unavailable endpoint="/api/admin/analytics/visits/timeseries" service="analytics" /> : <Alert>{visits.error}</Alert>}
        </div>

        <aside>
          <div className="rule-head"><h2>Catalogue health</h2><span className="kicker">learning-service</span></div>
          {catalogue.loading ? <Loading /> : catalogue.error ? <Alert>{catalogue.error}</Alert> : (
            <>
              <div className="settings-row"><span style={{ flex: 1 }}>Topics</span><b>{catalogue.data!.cats.length}</b></div>
              <div className="settings-row"><span style={{ flex: 1 }}>Signs</span><b>{v.length}</b></div>
              <div className="settings-row">
                <span style={{ flex: 1 }}>Signs not wired to the AI model<br /><small className="muted">Learners cannot practise these</small></span>
                <b style={{ color: noModel ? 'var(--lacquer)' : undefined }}>{noModel}</b>
              </div>
              <div className="settings-row"><span style={{ flex: 1 }}>Signs without a tutorial video</span><b>{noVideo}</b></div>
              <div className="settings-row">
                <span style={{ flex: 1 }}>Empty topics<br /><small className="muted">{emptyCats.map(c => c.name).join(', ') || 'None'}</small></span>
                <b>{emptyCats.length}</b>
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <Link className="btn btn-sm" to="/admin/signs"><Icon name="grid" size={14} /> Manage signs</Link>
                <Link className="btn btn-ghost btn-sm" to="/admin/requests"><Icon name="inbox" size={14} /> Sign requests</Link>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
