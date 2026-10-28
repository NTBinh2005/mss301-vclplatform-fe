import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Avatar, Loading } from '../../components/common';
import { adminApi, categoryApi, namesFor, vocabularyApi } from '../../services';
import type { UserSummary, VisitLogResponse } from '../../models';
import { timeAgo } from '../../lib/format';
import { PageHead, Unavailable, useLoad } from './shared';

const iso = (d: Date) => d.toISOString().slice(0, 10);
type Gran = 'DAY' | 'MONTH' | 'YEAR';
const RANGES: Record<Gran, { label: string; back: (d: Date) => Date; tick: (l: string) => string }> = {
  DAY: { label: 'Last 14 days', back: d => new Date(d.getTime() - 13 * 864e5), tick: l => l.slice(-5) },
  MONTH: { label: 'Last 12 months', back: d => new Date(d.getFullYear(), d.getMonth() - 11, 1), tick: l => l.slice(-5) },
  YEAR: { label: 'Last 5 years', back: d => new Date(d.getFullYear() - 4, 0, 1), tick: l => l },
};

export default function AdminOverview() {
  const [gran, setGran] = useState<Gran>('DAY');
  const summary = useLoad(() => adminApi.summary());
  const social = useLoad(() => adminApi.socialOverview());
  const visits = useLoad(() => {
    const to = new Date();
    return adminApi.visits(iso(RANGES[gran].back(to)), iso(to), gran);
  });
  useEffect(() => { visits.reload(); }, [gran]);
  // Catalogue health reads learning-service directly.
  const catalogue = useLoad(async () => {
    const [cats, vocab] = await Promise.all([categoryApi.list(0, 200), vocabularyApi.list(0, 1000)]);
    return { cats: cats.content, vocab: vocab.content };
  });

  const v = catalogue.data?.vocab ?? [];
  const noModel = v.filter(x => x.expectedId == null).length;
  const noVideo = v.filter(x => !x.videoTutorialUrl).length;
  const emptyCats = (catalogue.data?.cats ?? []).filter(c => !v.some(x => x.categoryId === c.id));
  const max = Math.max(1, ...(visits.data ?? []).map(p => p.count));
  const s = summary.data;

  return (
    <>
      <PageHead kicker="Admin · overview" title={<>The <em>back office</em>.</>} />

      {s ? (
        <div className="tiles figs">
          <div className="fig"><b>{s.totalStudents ?? '—'}</b><span>learners</span></div>
          <div className="fig"><b>{s.totalVisits}</b><span>visits</span></div>
          <div className="fig"><b>{s.totalVocabularies}</b><span>signs</span></div>
          <div className="fig"><b>{s.totalBlogs ?? '—'}</b><span>published posts</span></div>
        </div>
      ) : summary.loading ? <Loading /> : summary.missing ? <Unavailable endpoint="/api/visits/admin/summary" service="learning-service" /> : <Alert>{summary.error}</Alert>}

      <div className="two-col">
        <div>
          <div className="rule-head">
            <h2>Visits · {RANGES[gran].label.toLowerCase()}</h2>
            <div className="seg" role="tablist">
              {(['DAY', 'MONTH', 'YEAR'] as Gran[]).map(g => (
                <button key={g} role="tab" aria-selected={gran === g} className={gran === g ? 'on' : ''} onClick={() => setGran(g)}>{g.toLowerCase()}</button>
              ))}
            </div>
          </div>
          {visits.data ? (
            visits.data.length ? (
              <>
                <div className="bars" role="img" aria-label="Visits over time">
                  {visits.data.map(p => <div key={p.label} className="bar" style={{ height: `${(p.count / max) * 100}%` }}><span>{p.count}</span></div>)}
                </div>
                <div className="bar-labels">{visits.data.map(p => <span key={p.label}>{RANGES[gran].tick(p.label)}</span>)}</div>
              </>
            ) : <p className="muted">No visits recorded in this range.</p>
          ) : visits.loading ? <Loading /> : <Alert>{visits.error}</Alert>}

          <div className="rule-head"><h2>Latest visits</h2><span className="kicker">guests and signed-in learners</span></div>
          <VisitLogs />
        </div>

        <aside>
          <div className="rule-head"><h2>Community</h2><span className="kicker">social-service</span></div>
          {social.data ? (
            <>
              <div className="settings-row"><span style={{ flex: 1 }}>Posts published / drafts / removed</span><b>{social.data.publishedBlogs} / {social.data.draftBlogs} / {social.data.hiddenBlogs}</b></div>
              <div className="settings-row"><span style={{ flex: 1 }}>Likes · comments · shares</span><b>{social.data.totalLikes} · {social.data.totalComments} · {social.data.totalShares}</b></div>
              <div className="settings-row">
                <span style={{ flex: 1 }}>Open reports<br /><small className="muted">{social.data.resolvedReports} removed · {social.data.rejectedReports} dismissed</small></span>
                <b style={{ color: social.data.pendingReports ? 'var(--lacquer)' : undefined }}>{social.data.pendingReports}</b>
              </div>
              <div className="row" style={{ marginTop: 12 }}><Link className="btn btn-ghost btn-sm" to="/admin/reports"><Icon name="flag" size={14} /> Review reports</Link></div>
            </>
          ) : social.loading ? <Loading /> : <Alert>{social.error}</Alert>}

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

function VisitLogs() {
  const [page, setPage] = useState(0);
  const logs = useLoad(async () => {
    const res = await adminApi.visitLogs(page, 10);
    return { res, names: await namesFor(res.content.map(l => l.userId)) };
  });
  useEffect(() => { logs.reload(); }, [page]);
  if (logs.loading && !logs.data) return <Loading />;
  if (logs.error) return <Alert>{logs.error}</Alert>;
  const { res, names } = logs.data!;
  if (!res.content.length) return <p className="muted">No visits yet.</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Visitor</th><th>Device</th><th>Where</th><th>When</th></tr></thead>
          <tbody>{res.content.map(l => <VisitRow key={l.id} l={l} u={l.userId != null ? names.get(l.userId) : undefined} />)}</tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><Icon name="arrowl" size={14} /> Newer</button>
        <span className="faint" style={{ fontSize: 13 }}>Page {page + 1} of {Math.max(1, res.totalPages)}</span>
        <button className="btn btn-ghost btn-sm" disabled={res.last} onClick={() => setPage(p => p + 1)}>Older <Icon name="arrowr" size={14} /></button>
      </div>
    </>
  );
}

function VisitRow({ l, u }: { l: VisitLogResponse; u?: UserSummary }) {
  const who = l.visitorType === 'USER' ? (u ? u.fullName || u.username : `Learner #${l.userId}`) : 'Guest';
  return (
    <tr>
      <td><div className="row"><Avatar name={who} url={u?.avatarUrl} size={26} /><span>{who}</span></div></td>
      <td className="muted" style={{ maxWidth: 220 }}>{l.deviceInfo || '—'}</td>
      <td className="muted">{l.location || l.ipAddress || '—'}</td>
      <td className="muted">{timeAgo(l.visitedAt)}</td>
    </tr>
  );
}
