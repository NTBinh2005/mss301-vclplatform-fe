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

const FILTERS: [ReportStatus | '', string][] = [['PENDING', 'Đang chờ'], ['RESOLVED', 'Đã gỡ bài'], ['REJECTED', 'Đã bác bỏ'], ['', 'Tất cả']];
const PILL: Record<ReportStatus, [string, string]> = { PENDING: ['Đang chờ', 'lacquer'], RESOLVED: ['Đã gỡ bài', 'ink'], REJECTED: ['Đã bác bỏ', ''] };

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
    try { replace(await adminApi.rejectReport(r.id)); pending.reload(); ui.toast('Đã bác bỏ tố cáo — bài viết được giữ lại'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Không bác bỏ được tố cáo'), 'alert'); }
  };

  const resolve = (r: ReportResponse) => {
    if (!r.blogId) return;
    ui.openModal(<RemoveForm post={{ id: r.blogId, title: r.blogTitle || 'bài viết này' }} reportId={r.id} onDone={() => {
      ui.closeLayer(); refresh(); ui.toast('Đã gỡ bài và đóng các tố cáo đang chờ', 'shield');
    }} />, 'Gỡ bài viết');
  };

  const view = (r: ReportResponse) => ui.openModal(<ReportDetail id={r.id} onResolve={() => resolve(r)} onReject={() => { ui.closeLayer(); reject(r); }} />, 'Tố cáo');

  return (
    <>
      <PageHead kicker="Quản trị · social-service" title={<>Tố cáo <em>{pending.data ? `(${pending.data} đang chờ)` : ''}</em></>} />
      <div className="toolbar">
        <div className="seg" role="tablist">
          {FILTERS.map(([s, label]) => (
            <button key={label} role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{label}</button>
          ))}
        </div>
      </div>
      {list.missing ? <Unavailable endpoint="/api/blogs/admin/reports" service="social-service" /> : list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : (
        list.data!.content.length === 0 ? <EmptyState title="Không có tố cáo" body="Khi học viên tố cáo một bài viết, nó sẽ xuất hiện ở đây." /> : (
          <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 12 }}>
            {list.data!.content.map(r => {
              const [label, cls] = PILL[r.status];
              return (
                <div className="mypost" key={r.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ marginBottom: 4 }}>
                      <span className={`pill ${cls}`}>{label}</span>
                      {r.blogStatus === 'HIDDEN' && r.status !== 'RESOLVED' && <span className="pill dashed">bài đã bị gỡ</span>}
                      <span className="faint" style={{ fontSize: 12.5 }}>{nameOf(r.reporter)} · {timeAgo(r.createdAt)}</span>
                    </div>
                    <h4>“{r.reason}”</h4>
                    <p><b>{r.blogTitle || 'Bài đã xóa'}</b> <button className="linkbtn" onClick={() => view(r)}>Đọc bài viết</button></p>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="row">
                      <button className="btn btn-ghost btn-sm" onClick={() => reject(r)}><Icon name="check" size={14} /> Giữ bài</button>
                      {r.blogId && r.blogStatus !== 'HIDDEN' && <button className="btn btn-lacquer btn-sm" onClick={() => resolve(r)}><Icon name="shield" size={14} /> Gỡ bài</button>}
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
  useEffect(() => { adminApi.report(id).then(setD).catch(err => setError(apiErrorMessage(err, 'Không tải được tố cáo.'))); }, [id]);
  if (error) return <Alert>{error}</Alert>;
  if (!d) return <Loading />;
  return (
    <article>
      <p className="kicker">{nameOf(d.reporter)} tố cáo · {timeAgo(d.createdAt)}</p>
      <h2>“{d.reason}”</h2>
      <div className="rule-head"><h3 style={{ margin: 0 }}>{d.blogTitle || 'Bài đã xóa'}</h3><span className="kicker">của {nameOf(d.author)}</span></div>
      {d.deletionReason && <p className="removed-note"><Icon name="alert" size={13} /> Đã gỡ: {d.deletionReason}</p>}
      {d.blogThumbnailUrl && <img className="post-thumb" src={d.blogThumbnailUrl} alt="" />}
      <div className="post-body">{d.blogContent}</div>
      {d.status === 'PENDING' && (
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onReject}><Icon name="check" size={15} /> Giữ bài</button>
          {d.blogStatus !== 'HIDDEN' && <button className="btn btn-lacquer" onClick={onResolve}><Icon name="shield" size={15} /> Gỡ bài</button>}
        </div>
      )}
    </article>
  );
}
