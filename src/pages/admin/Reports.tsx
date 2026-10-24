import Icon from '../../components/Icon';
import { Alert, EmptyState, Loading } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { adminApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { BlogReportResponse, PageResponse } from '../../models';
import { excerpt, timeAgo } from '../../lib/format';
import { RemoveForm } from './Posts';
import { PageHead, Unavailable, useLoad } from './shared';

export default function AdminReports() {
  const ui = useUI();
  const list = useLoad(() => adminApi.reports(0, 100));
  const markResolved = (id: number) =>
    list.setData(d => d && ({ ...d, content: d.content.map(x => (x.id === id ? { ...x, status: 'RESOLVED' } : x)) }) as PageResponse<BlogReportResponse>);

  const resolve = async (r: BlogReportResponse) => {
    try { await adminApi.resolveReport(r.id); markResolved(r.id); ui.toast('Report dismissed — the post stays up'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not resolve the report'), 'alert'); }
  };

  const remove = (r: BlogReportResponse) => {
    if (!r.blogId) return;
    ui.openModal(<RemoveForm post={{ id: r.blogId, title: r.blogTitle || 'this post' }} onDone={() => {
      ui.closeLayer();
      list.reload();
      ui.toast('Post removed', 'shield');
    }} />, 'Remove post');
  };

  const pending = list.data?.content.filter(r => r.status === 'PENDING').length ?? 0;

  return (
    <>
      <PageHead kicker="Admin · social-service" title={<>Reports <em>{pending ? `(${pending} open)` : ''}</em></>} />
      {list.missing ? <Unavailable endpoint="/api/admin/reports" service="social-service" /> : list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : (
        list.data!.content.length === 0 ? <EmptyState title="No reports" body="When a learner flags a post, it lands here." /> : (
          <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 12 }}>
            {list.data!.content.map(r => (
              <div className="mypost" key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span className={`pill ${r.status === 'PENDING' ? 'lacquer' : ''}`}>{r.status === 'PENDING' ? 'Open' : 'Resolved'}</span>
                    {r.blogStatus === 'REMOVED' && <span className="pill dashed">post removed</span>}
                    <span className="faint" style={{ fontSize: 12.5 }}>{r.reporterName || 'Someone'} · {timeAgo(r.createdAt)}</span>
                  </div>
                  <h4>“{r.reason}”</h4>
                  <p><b>{r.blogTitle || 'Deleted post'}</b>{r.blogAuthorName ? ` by ${r.blogAuthorName}` : ''}{r.blogContent ? ` — ${excerpt(r.blogContent, 140)}` : ''}</p>
                </div>
                {r.status === 'PENDING' && (
                  <div className="row">
                    <button className="btn btn-ghost btn-sm" onClick={() => resolve(r)}><Icon name="check" size={14} /> Keep post</button>
                    {r.blogId && r.blogStatus !== 'REMOVED' && <button className="btn btn-lacquer btn-sm" onClick={() => remove(r)}><Icon name="shield" size={14} /> Remove post</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
