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
const GRAN_LABEL: Record<Gran, string> = { DAY: 'ngày', MONTH: 'tháng', YEAR: 'năm' };
const RANGES: Record<Gran, { label: string; back: (d: Date) => Date; tick: (l: string) => string }> = {
  DAY: { label: '14 ngày qua', back: d => new Date(d.getTime() - 13 * 864e5), tick: l => l.slice(-5) },
  MONTH: { label: '12 tháng qua', back: d => new Date(d.getFullYear(), d.getMonth() - 11, 1), tick: l => l.slice(-5) },
  YEAR: { label: '5 năm qua', back: d => new Date(d.getFullYear() - 4, 0, 1), tick: l => l },
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
      <PageHead kicker="Quản trị · tổng quan" title={<>Trang <em>quản trị</em>.</>} />

      {s ? (
        <div className="tiles figs">
          <div className="fig"><b>{s.totalStudents ?? '—'}</b><span>học viên</span></div>
          <div className="fig"><b>{s.totalVisits}</b><span>lượt truy cập</span></div>
          <div className="fig"><b>{s.totalVocabularies}</b><span>ký hiệu</span></div>
          <div className="fig"><b>{s.totalBlogs ?? '—'}</b><span>bài đã đăng</span></div>
        </div>
      ) : summary.loading ? <Loading /> : summary.missing ? <Unavailable endpoint="/api/visits/admin/summary" service="learning-service" /> : <Alert>{summary.error}</Alert>}

      <div className="two-col">
        <div>
          <div className="rule-head">
            <h2>Lượt truy cập · {RANGES[gran].label}</h2>
            <div className="seg" role="tablist">
              {(['DAY', 'MONTH', 'YEAR'] as Gran[]).map(g => (
                <button key={g} role="tab" aria-selected={gran === g} className={gran === g ? 'on' : ''} onClick={() => setGran(g)}>{GRAN_LABEL[g]}</button>
              ))}
            </div>
          </div>
          {visits.data ? (
            visits.data.length ? (
              <>
                <div className="bars" role="img" aria-label="Lượt truy cập theo thời gian">
                  {visits.data.map(p => <div key={p.label} className="bar" style={{ height: `${(p.count / max) * 100}%` }}><span>{p.count}</span></div>)}
                </div>
                <div className="bar-labels">{visits.data.map(p => <span key={p.label}>{RANGES[gran].tick(p.label)}</span>)}</div>
              </>
            ) : <p className="muted">Không có lượt truy cập trong khoảng này.</p>
          ) : visits.loading ? <Loading /> : <Alert>{visits.error}</Alert>}

          <div className="rule-head"><h2>Truy cập gần đây</h2><span className="kicker">khách và học viên đã đăng nhập</span></div>
          <VisitLogs />
        </div>

        <aside>
          <div className="rule-head"><h2>Cộng đồng</h2><span className="kicker">social-service</span></div>
          {social.data ? (
            <>
              <div className="settings-row"><span style={{ flex: 1 }}>Bài đã đăng / nháp / bị gỡ</span><b>{social.data.publishedBlogs} / {social.data.draftBlogs} / {social.data.hiddenBlogs}</b></div>
              <div className="settings-row"><span style={{ flex: 1 }}>Lượt thích · bình luận · chia sẻ</span><b>{social.data.totalLikes} · {social.data.totalComments} · {social.data.totalShares}</b></div>
              <div className="settings-row">
                <span style={{ flex: 1 }}>Tố cáo đang chờ<br /><small className="muted">{social.data.resolvedReports} đã gỡ bài · {social.data.rejectedReports} bác bỏ</small></span>
                <b style={{ color: social.data.pendingReports ? 'var(--lacquer)' : undefined }}>{social.data.pendingReports}</b>
              </div>
              <div className="row" style={{ marginTop: 12 }}><Link className="btn btn-ghost btn-sm" to="/admin/reports"><Icon name="flag" size={14} /> Xử lý tố cáo</Link></div>
            </>
          ) : social.loading ? <Loading /> : <Alert>{social.error}</Alert>}

          <div className="rule-head"><h2>Tình trạng kho ký hiệu</h2><span className="kicker">learning-service</span></div>
          {catalogue.loading ? <Loading /> : catalogue.error ? <Alert>{catalogue.error}</Alert> : (
            <>
              <div className="settings-row"><span style={{ flex: 1 }}>Chủ đề</span><b>{catalogue.data!.cats.length}</b></div>
              <div className="settings-row"><span style={{ flex: 1 }}>Ký hiệu</span><b>{v.length}</b></div>
              <div className="settings-row">
                <span style={{ flex: 1 }}>Ký hiệu chưa nối mô hình AI<br /><small className="muted">Học viên chưa luyện được các ký hiệu này</small></span>
                <b style={{ color: noModel ? 'var(--lacquer)' : undefined }}>{noModel}</b>
              </div>
              <div className="settings-row"><span style={{ flex: 1 }}>Ký hiệu chưa có video hướng dẫn</span><b>{noVideo}</b></div>
              <div className="settings-row">
                <span style={{ flex: 1 }}>Chủ đề trống<br /><small className="muted">{emptyCats.map(c => c.name).join(', ') || 'Không có'}</small></span>
                <b>{emptyCats.length}</b>
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <Link className="btn btn-sm" to="/admin/signs"><Icon name="grid" size={14} /> Quản lý ký hiệu</Link>
                <Link className="btn btn-ghost btn-sm" to="/admin/requests"><Icon name="inbox" size={14} /> Đề xuất ký hiệu</Link>
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
  if (!res.content.length) return <p className="muted">Chưa có lượt truy cập.</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Người truy cập</th><th>Thiết bị</th><th>Vị trí</th><th>Thời gian</th></tr></thead>
          <tbody>{res.content.map(l => <VisitRow key={l.id} l={l} u={l.userId != null ? names.get(l.userId) : undefined} />)}</tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><Icon name="arrowl" size={14} /> Mới hơn</button>
        <span className="faint" style={{ fontSize: 13 }}>Trang {page + 1}/{Math.max(1, res.totalPages)}</span>
        <button className="btn btn-ghost btn-sm" disabled={res.last} onClick={() => setPage(p => p + 1)}>Cũ hơn <Icon name="arrowr" size={14} /></button>
      </div>
    </>
  );
}

function VisitRow({ l, u }: { l: VisitLogResponse; u?: UserSummary }) {
  const who = l.visitorType === 'USER' ? (u ? u.fullName || u.username : `Học viên #${l.userId}`) : 'Khách';
  return (
    <tr>
      <td><div className="row"><Avatar name={who} url={u?.avatarUrl} size={26} /><span>{who}</span></div></td>
      <td className="muted" style={{ maxWidth: 220 }}>{l.deviceInfo || '—'}</td>
      <td className="muted">{l.location || l.ipAddress || '—'}</td>
      <td className="muted">{timeAgo(l.visitedAt)}</td>
    </tr>
  );
}
