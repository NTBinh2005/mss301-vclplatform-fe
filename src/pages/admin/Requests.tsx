import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, EmptyState, Loading } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { adminApi, namesFor } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { PageResponse, VocabularySuggestionResponse } from '../../models';
import { timeAgo } from '../../lib/format';
import { PageHead, Unavailable, useLoad } from './shared';

type Row = VocabularySuggestionResponse & { requesterName: string };

export default function AdminRequests() {
  const ui = useUI();
  // learning-service only knows the requester's id; identity resolves the names in one call.
  const list = useLoad(async () => {
    const page = await adminApi.suggestions(0, 100);
    const names = await namesFor(page.content.map(s => s.requesterId));
    const rows: Row[] = page.content.map(s => {
      const u = names.get(s.requesterId);
      return { ...s, requesterName: u ? u.fullName || u.username : `#${s.requesterId}` };
    });
    return { ...page, content: rows } as PageResponse<Row>;
  });

  const reviewed = async (s: Row) => {
    try {
      await adminApi.markSuggestionReviewed(s.id);
      list.setData(d => d && ({ ...d, content: d.content.map(x => (x.id === s.id ? { ...x, status: 'REVIEWED' } : x)) }) as PageResponse<Row>);
      ui.toast(`“${s.word}” marked as reviewed`);
    } catch (err) { ui.toast(apiErrorMessage(err, 'Could not update the request'), 'alert'); }
  };

  const pending = list.data?.content.filter(s => s.status === 'PENDING').length ?? 0;

  return (
    <>
      <PageHead kicker="Admin · learner requests" title={<>Sign <em>requests</em></>}>
        <Link className="btn btn-ghost btn-sm" to="/admin/signs"><Icon name="plus" size={14} /> Add a sign</Link>
      </PageHead>
      <p className="lede" style={{ marginTop: 0 }}>{pending ? `${pending} waiting for review.` : 'Words learners asked the dictionary to include.'}</p>
      {list.missing ? <Unavailable endpoint="/api/vocabulary-suggestions/admin" service="learning-service" /> : list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : (
        list.data!.content.length === 0 ? <EmptyState title="No requests yet" body="Learners can request missing signs from the Dictionary." /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Word</th><th>Topic</th><th>Why</th><th>From</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {list.data!.content.map(s => (
                  <tr key={s.id}>
                    <td className="word">{s.word}</td>
                    <td>{s.categoryName}</td>
                    <td className="muted" style={{ maxWidth: 320 }}>{s.description || '—'}</td>
                    <td className="muted">{s.requesterName}<br /><span className="faint" style={{ fontSize: 12 }}>{timeAgo(s.createdAt)}</span></td>
                    <td><span className={`pill ${s.status === 'REVIEWED' ? 'ink' : 'dashed'}`}>{s.status === 'REVIEWED' ? 'Reviewed' : 'Pending'}</span></td>
                    <td><div className="actions">
                      {s.status === 'PENDING' && <>
                        <Link className="btn btn-ghost btn-sm" to={`/admin/signs?new=${encodeURIComponent(s.word)}${s.categoryId ? `&cat=${s.categoryId}` : ''}`}><Icon name="plus" size={14} /> Add sign</Link>
                        <button className="btn btn-ghost btn-sm" onClick={() => reviewed(s)}><Icon name="check" size={14} /> Mark reviewed</button>
                      </>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
