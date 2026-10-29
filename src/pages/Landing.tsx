import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Hand, SignPlayer, type Frame } from '../components/Hand';
import { Brand, ThemePicker, ArtBanner } from '../components/common';
import { useAuth } from '../context/AuthContext';
import { publicApi } from '../services';
import type { PublicStats } from '../models';

const HELLO: Frame[] = [{ shape: 'flat' }, { shape: 'flat', rot: 13, dx: 5 }, { shape: 'flat', rot: -9 }, { shape: 'flat', rot: 12, dx: 4 }];

export default function Landing() {
  const { status, isAdmin } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const home = isAdmin ? '/admin' : '/today';

  useEffect(() => { publicApi.stats().then(setStats).catch(() => {}); }, []);

  return (
    <>
      <header className="landing-top">
        <Brand />
        <span className="spacer" />
        <ThemePicker />
        {status === 'authed' ? (
          <Link className="btn btn-sm" to={home}>Vào SignMentor <Icon name="arrowr" size={15} /></Link>
        ) : (
          <>
            <Link className="textlink hide-sm" to="/login">Đăng nhập</Link>
            <Link className="btn btn-lacquer btn-sm" to="/register">Bắt đầu học</Link>
          </>
        )}
      </header>
      <main>
        <section className="view">
          <div className="hero">
            <span className="hero-hand" aria-hidden="true"><Hand frame={{ shape: 'open', rot: 10 }} size={460} /></span>
            <div className="hero-copy" style={{ position: 'relative' }}>
              <div className="hero-badge">
                <span className="mentor-dot" />
                <p className="kicker">Ngôn ngữ Ký hiệu Việt Nam · có huấn luyện viên AI</p>
              </div>
              <h1 className="display">Học cách trò chuyện bằng <em>đôi tay</em>.</h1>
              <p className="lede">
                Xem một ký hiệu, làm theo trước camera và được chấm điểm bởi mô hình học từ người ký thật.
                Bài học ngắn, nhận xét thẳng thắn, và một <strong>cộng đồng luôn đi trước bạn một chương</strong>.
              </p>
              <div className="row hero-cta" style={{ marginTop: 28 }}>
                <Link className="btn btn-lacquer" to={status === 'authed' ? home : '/register'}>
                  <Icon name="play" size={16} /> {status === 'authed' ? 'Học tiếp' : 'Tạo tài khoản miễn phí'}
                </Link>
                {status !== 'authed' && <Link className="btn btn-ghost" to="/login">Tôi đã có tài khoản</Link>}
              </div>
              {stats && (
                <div className="figs hero-figs" role="list" style={{ margin: '36px 0 0' }}>
                  <div className="fig" role="listitem"><b>{stats.totalVocabs}</b><span>ký hiệu để học</span></div>
                  <div className="fig" role="listitem"><b>{stats.totalUsers ?? '—'}</b><span>học viên</span></div>
                  <div className="fig" role="listitem"><b>{Math.round(stats.satisfactionRate)}%</b><span>hài lòng</span></div>
                </div>
              )}
            </div>
            <div className="hero-stage">
              <div className="hero-photo-strip" aria-hidden="true">
                <img src="/banners/landing-hero.jpg" alt="" />
                <div className="hero-photo-overlay">
                  <span className="glass-pill"><Icon name="users" size={12} /> Học cùng người thật & AI</span>
                  <span className="glass-pill warm"><Icon name="sparkles" size={12} /> Chấm điểm 21 khớp tay</span>
                </div>
              </div>
              <div className="stage-top">
                <span className="pill mentor"><Icon name="sparkles" size={12} /> Ký hiệu mẫu</span>
                <span className="pill">Chương 1 · Chào hỏi</span>
              </div>
              <SignPlayer frames={HELLO} size={185} autoplay />
              <p className="notation" style={{ marginTop: 10 }}><span className="hs-chip">B</span>Xin chào — bàn tay duỗi, lòng tay hướng ra, vẫy hai lần</p>
            </div>
          </div>

          <div className="rule-head">
            <h2>Học như thế nào</h2>
            <span className="kicker">Vòng lặp 3 bước · xem → làm → được AI chấm</span>
          </div>
          <div className="steps-3">
            <div className="step-card">
              <ArtBanner variant="step-watch" />
              <div className="step-card-top">
                <span className="step-icon"><Icon name="video" size={20} /></span>
                <b>01</b>
              </div>
              <h3>Xem</h3>
              <p>Mỗi ký hiệu có video hướng dẫn và nằm trong một bài ngắn gồm ba ký hiệu, sắp theo trình tự của một cuộc trò chuyện.</p>
            </div>
            <div className="step-card">
              <ArtBanner variant="step-practice" />
              <div className="step-card-top">
                <span className="step-icon lacquer"><Icon name="camera" size={20} /></span>
                <b>02</b>
              </div>
              <h3>Làm</h3>
              <p>Mở Phòng tập, ký trước camera trong năm giây, mô hình sẽ cho bạn biết mình đã làm đúng đến đâu.</p>
            </div>
            <div className="step-card">
              <ArtBanner variant="step-remember" />
              <div className="step-card-top">
                <span className="step-icon mentor"><Icon name="trophy" size={20} /></span>
                <b>03</b>
              </div>
              <h3>Nhớ</h3>
              <p>Ký hiệu chưa làm đúng sẽ quay lại để ôn. Chuỗi ngày học, độ chính xác và thành tích theo dõi phần còn lại.</p>
            </div>
          </div>

          <div className="cta-band">
            <div>
              <p className="kicker" style={{ color: 'rgba(255,255,255,.72)' }}>Năm phút mỗi ngày</p>
              <h2 className="display sm">Lời <em>xin chào</em> đầu tiên chỉ cách bạn một bài học.</h2>
            </div>
            <Link className="btn cream" to={status === 'authed' ? home : '/register'}>Bắt đầu ngay <Icon name="arrowr" size={16} /></Link>
          </div>
        </section>
      </main>
      <footer>
        <span>SignMentor — dành cho người học Ngôn ngữ Ký hiệu Việt Nam.</span>
        <span>MSS301 · VSL Platform</span>
      </footer>
    </>
  );
}
