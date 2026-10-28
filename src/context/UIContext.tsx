import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon, { type IconName } from '../components/Icon';

type Layer =
  | { kind: 'modal'; node: ReactNode; label?: string }
  | { kind: 'palette' }
  | { kind: 'mentor'; ask?: string };

interface Toast { id: number; msg: string; icon: IconName; gone: boolean }

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface UIValue {
  layer: Layer | null;
  toast: (msg: string, icon?: IconName) => void;
  openModal: (node: ReactNode, label?: string) => void;
  openPalette: () => void;
  openMentor: (ask?: string) => void;
  closeLayer: () => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const UIContext = createContext<UIValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [layer, setLayer] = useState<Layer | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  // A pending confirm() resolves false if its dialog is closed any other way.
  const pending = useRef<((ok: boolean) => void) | null>(null);
  const settle = (ok: boolean) => { const r = pending.current; pending.current = null; r?.(ok); };

  const toast = useCallback((msg: string, icon: IconName = 'check') => {
    const id = ++seq.current;
    setToasts(t => [...t, { id, msg, icon, gone: false }]);
    window.setTimeout(() => setToasts(t => t.map(x => (x.id === id ? { ...x, gone: true } : x))), 2600);
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3100);
  }, []);

  const closeLayer = useCallback(() => { settle(false); setLayer(null); }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>(resolve => {
    settle(false);
    pending.current = resolve;
    const done = (ok: boolean) => { settle(ok); setLayer(null); };
    setLayer({ kind: 'modal', label: opts.title, node: <ConfirmDialog {...opts} onDone={done} /> });
  }), []);

  const value = useMemo<UIValue>(() => ({
    layer,
    toast,
    openModal: (node, label) => { settle(false); setLayer({ kind: 'modal', node, label }); },
    openPalette: () => { settle(false); setLayer({ kind: 'palette' }); },
    openMentor: ask => { settle(false); setLayer({ kind: 'mentor', ask }); },
    closeLayer,
    confirm,
  }), [layer, toast, closeLayer, confirm]);

  useEffect(() => {
    if (!layer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLayer(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layer, closeLayer]);

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.gone ? 'gone' : ''}`}><Icon name={t.icon} size={17} /><span>{t.msg}</span></div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

function ConfirmDialog({ title, body, confirmLabel = 'Xác nhận', danger, onDone }: ConfirmOptions & { onDone: (ok: boolean) => void }) {
  return (
    <div className="confirm">
      <p className="kicker">{danger ? 'Vui lòng xác nhận' : 'Xác nhận'}</p>
      <h2>{title}</h2>
      {body && <p className="muted" style={{ marginTop: 8 }}>{body}</p>}
      <div className="form-actions" style={{ marginTop: 24 }}>
        <button type="button" className={`btn ${danger ? 'btn-danger' : ''}`} onClick={() => onDone(true)} data-autofocus>{confirmLabel}</button>
        <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>Hủy</button>
      </div>
    </div>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
}

/* The overlay host. Each shell renders one; palette and Mentor are supplied by
   the learner shell because they need learning data. */
export function LayerHost({ palette, mentor }: { palette?: ReactNode; mentor?: (ask?: string) => ReactNode }) {
  const { layer, closeLayer } = useUI();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layer) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current?.querySelector<HTMLElement>('[data-autofocus], .modal, .palette input, .drawer input');
    el?.focus();
    return () => prev?.focus?.();
  }, [layer]);

  if (!layer) return null;
  if (layer.kind === 'palette' && !palette) return null;
  if (layer.kind === 'mentor' && !mentor) return null;

  return (
    <div className="overlay-layer" ref={ref}>
      <div className="veil" onClick={closeLayer} />
      {layer.kind === 'modal' && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={layer.label} tabIndex={-1}>
          <button type="button" className="iconbtn modal-close" onClick={closeLayer} aria-label="Đóng"><Icon name="x" /></button>
          {layer.node}
        </div>
      )}
      {layer.kind === 'palette' && palette}
      {layer.kind === 'mentor' && mentor?.(layer.ask)}
    </div>
  );
}
