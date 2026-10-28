import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { apiErrorMessage } from '../../api/errors';

export interface Loaded<T> {
  data: T | null;
  error: string;
  missing: boolean; // the endpoint is not deployed / routed by the gateway yet
  loading: boolean;
  reload: () => void;
  setData: (fn: (d: T | null) => T | null) => void;
}

export function useLoad<T>(fn: () => Promise<T>): Loaded<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  // Always call the latest loader, so filters captured in its closure are current.
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const reload = useCallback(() => {
    const my = ++seq.current;
    setLoading(true);
    fnRef.current()
      .then(d => { if (my !== seq.current) return; setDataState(d); setError(''); setMissing(false); })
      .catch(err => {
        if (my !== seq.current) return;
        const status = isAxiosError(err) ? err.response?.status : undefined;
        setMissing(status === 404 || status === 502 || status === 503);
        setError(apiErrorMessage(err, 'Không tải được mục này.'));
      })
      .finally(() => { if (my === seq.current) setLoading(false); });
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { data, error, missing, loading, reload, setData: f => setDataState(f) };
}

export function Unavailable({ endpoint, service }: { endpoint: string; service: string }) {
  return (
    <div className="unavailable">
      <strong>Chưa sẵn sàng.</strong> Màn hình này gọi <code>{endpoint}</code> của <code>{service}</code> nhưng
      API gateway không phản hồi. Màn hình sẽ hoạt động khi dịch vụ đó chạy và mở route này.
    </div>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28 }}>
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="display sm">{title}</h1>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}
