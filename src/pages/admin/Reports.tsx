import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, EmptyState, Loading } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { adminApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { PageResponse, ReportDetailResponse, ReportResponse, ReportStatus } from '../../models';
import { nameOf, timeAgo } from '../../lib/format';
import { RemoveForm } from './Posts';
import { PageHead, Unavailable, useLoad } from './shared';

const FILTERS: [ReportStatus | '', string][] = [['PENDING', 'Open'], ['RESOLVED', 'Post removed'], ['REJECTED', 'Dismissed'], ['', 'All']];
const PILL: Record<ReportStatus, [string, string]> = { PENDING: ['Open', 'lacquer'], RESOLVED: ['Post removed', 'ink'], REJECTED: ['Dismissed', ''] };

export default function AdminReports() {
  const ui = useUI();
  const [status, setStatus] = useState<ReportStatus | ''>('PENDING');
  const list = useLoad(() => adminApi.reports({ status: status || undefined, size: 50 }));
  const pending = useLoad(() => adminApi.pendingReports());
  useEffect(() => { list.reload(); }, [status]);

  const refresh = () => { list.reload(); pending.reload(); };
  const replace = (r: ReportResponse) =>
    list.setData(d => d && ({ ...d, content: d.content.map(x => (x.id === r.id ? r : x)) }) as PageResponse<ReportResponse>);

  const reject = async (r: ReportResponse) => {
    try { replace(await adminApi.rejectReport(r.id)); pending.reload(); ui.toast('Report dismissed — the post stays up'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not dismiss the report'), 'alert'); }
  };

  const resolve = (r: ReportResponse) => {
    if (!r.blogId) return;
    ui.openModal(<RemoveForm post={{ id: r.blogId, title: r.blogTitle || 'this post' }} reportId={r.id} onDone={() => {
      ui.closeLayer(); refresh(); ui.toast('Post removed and its open reports closed', 'shield');
    }} />, 'Remove post');
  };

  const view = (r: ReportResponse) => ui.openModal(<ReportDetail id={r.id} onResolve={() => resolve(r)} onReject={() => { ui.closeLayer(); reject(r); }} />, 'Report');

  return (
    <>
      <PageHead kicker="Admin · social-service" title={<>Reports <em>{pending.data ? `(${pending.data} open)` : ''}</em></>} />
      <div className="toolbar">
        <div className="seg" role="tablist">
          {FILTERS.map(([s, label]) => (
            <button key={label} role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{label}</button>
          ))}
        </div>
      </div>
      {list.missing ? <Unavailable endpoint="/api/blogs/admin/reports" service="social-service" /> : list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : (
        list.data!.content.length === 0 ? <EmptyState title="No reports here" body="When a learner flags a post, it lands here." /> : (
          <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 12 }}>
            {list.data!.content.map(r => {
              const [label, cls] = PILL[r.status];
              return (
                <div className="mypost" key={r.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ marginBottom: 4 }}>
                      <span className={`pill ${cls}`}>{label}</span>
                      {r.blogStatus === 'HIDDEN' && r.status !== 'RESOLVED' && <span className="pill dashed">post removed</span>}
                      <span className="faint" style={{ fontSize: 12.5 }}>{nameOf(r.reporter)} · {timeAgo(r.createdAt)}</span>
                    </div>
                    <h4>“{r.reason}”</h4>
                    <p><b>{r.blogTitle || 'Deleted post'}</b> <button className="linkbtn" onClick={() => view(r)}>Read the post</button></p>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="row">
                      <button className="btn btn-ghost btn-sm" onClick={() => reject(r)}><Icon name="check" size={14} /> Keep post</button>
                      {r.blogId && r.blogStatus !== 'HIDDEN' && <button className="btn btn-lacquer btn-sm" onClick={() => resolve(r)}><Icon name="shield" size={14} /> Remove post</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </>
  );
}

function ReportDetail({ id, onResolve, onReject }: { id: number; onResolve: () => void; onReject: () => void }) {
  const [d, setD] = useState<ReportDetailResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { adminApi.report(id).then(setD).catch(err => setError(apiErrorMessage(err, 'Could not load the report.'))); }, [id]);
  if (error) return <Alert>{error}</Alert>;
  if (!d) return <Loading />;
  return (
    <article>
      <p className="kicker">Reported by {nameOf(d.reporter)} · {timeAgo(d.createdAt)}</p>
      <h2>“{d.reason}”</h2>
      <div className="rule-head"><h3 style={{ margin: 0 }}>{d.blogTitle || 'Deleted post'}</h3><span className="kicker">by {nameOf(d.author)}</span></div>
      {d.deletionReason && <p className="removed-note"><Icon name="alert" size={13} /> Removed: {d.deletionReason}</p>}
      {d.blogThumbnailUrl && <img className="post-thumb" src={d.blogThumbnailUrl} alt="" />}
      <div className="post-body">{d.blogContent}</div>
      {d.status === 'PENDING' && (
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onReject}><Icon name="check" size={15} /> Keep post</button>
          {d.blogStatus !== 'HIDDEN' && <button className="btn btn-lacquer" onClick={onResolve}><Icon name="shield" size={15} /> Remove post</button>}
        </div>
      )}
    </article>
  );
}
