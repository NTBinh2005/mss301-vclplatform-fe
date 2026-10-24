import { type ReactNode, useCallback, useEffect, useState } from 'react';
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

  const reload = useCallback(() => {
    setLoading(true);
    fn()
      .then(d => { setDataState(d); setError(''); setMissing(false); })
      .catch(err => {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        setMissing(status === 404 || status === 502 || status === 503);
        setError(apiErrorMessage(err, 'Could not load this section.'));
      })
      .finally(() => setLoading(false));
  }, []); // the loader is a stable module-level call

  useEffect(() => { reload(); }, [reload]);
  return { data, error, missing, loading, reload, setData: f => setDataState(f) };
}

export function Unavailable({ endpoint, service }: { endpoint: string; service: string }) {
  return (
    <div className="unavailable">
      <strong>Not available yet.</strong> This screen calls <code>{endpoint}</code> on <code>{service}</code>, which the
      API gateway did not answer. It will start working once that service exposes the route.
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
