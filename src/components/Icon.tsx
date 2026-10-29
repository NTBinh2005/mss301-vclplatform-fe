// The design's custom 24px line icon set, plus a few the prototype didn't need.
const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14M15 5v14" stroke-width="3"/>',
  arrowr: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  arrowl: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l2-3h2l2 3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  send: '<path d="M4 12 20 4l-6 16-2.5-6.5z"/>',
  heart: '<path d="M12 20C6.2 15.4 3 11.8 3 8.4A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.4c0 3.4-3.2 7-9 11.6z"/>',
  comment: '<path d="M21 12a8 8 0 0 1-8 8H5.5L7 16.8A8 8 0 1 1 21 12z"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-5h-6v5H4z"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M9 4v13"/>',
  grid: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  video: '<rect x="3" y="7" width="12" height="10" rx="2.5"/><path d="M15 10.5 21 7v10l-6-3.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.6a3.5 3.5 0 0 1 0 6.3M18.5 14.9c1.9.8 3 2.4 3 4.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
  flag: '<path d="M6 21V4h12l-3 4 3 4H6"/>',
  star: '<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z"/>',
  seal: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M4 4l16 16M10 6c.7-.3 1.3-.5 2-.5 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 7.6C4 9.4 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.5 4.2-1.1"/>',
  logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h11"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.3 2.4-5.4 3.6-8 .9 1.6 1.7 2.5 3.1 3 0-2.6 1-5.2 3.3-7 0 4 4.5 6.3 4.5 12 0 3.4-3 6-8 6z"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z"/>',
  sparkles: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM5 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM19 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  trophy: '<path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M6 4h12v5a6 6 0 0 1-12 0zM12 15v5M8 20h8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  zap: '<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  layers: '<polygon points="12 3 2 8 12 13 22 8 12 3"/><path d="m2 13 10 5 10-5M2 17.5l10 4.5 10-4.5"/>',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
