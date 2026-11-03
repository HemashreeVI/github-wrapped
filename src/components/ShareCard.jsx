import { useEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { formatHour } from '../lib/stats.js';

const W = 1080, H = 1350; // 4:5 — the tallest image LinkedIn and Instagram show uncropped in the feed

function shareUrl(data) {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('u', data.user.login);
  if (data.year !== new Date().getFullYear()) u.searchParams.set('y', data.year);
  return u.toString();
}

function Stat({ value, label, color }) {
  return (
    <div className="sc-stat" style={{ '--c': color }}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Fixed 1080×1350 card. Preview mode scales it to fit its container. */
export default function ShareCard({ data, exportRef }) {
  const { user, year, cal, langs, rhythm, repos, persona } = data;
  const wrap = useRef(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    if (exportRef) return;
    const el = wrap.current;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(e.contentRect.width / W, e.contentRect.height / H)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [exportRef]);

  const stats = [
    cal ? { value: cal.total.toLocaleString(), label: 'contributions', color: '#1ed760' } : { value: repos.newRepos, label: 'new repos', color: '#1ed760' },
    cal ? { value: `${cal.longestStreak}d`, label: 'longest streak', color: '#ff6b3d' } : { value: repos.totalStars, label: 'stars earned', color: '#ff6b3d' },
    langs.list[0] ? { value: langs.list[0].name, label: 'top language', color: langs.list[0].color } : { value: user.publicRepos, label: 'public repos', color: '#4da3ff' },
    rhythm ? { value: formatHour(rhythm.peakHour), label: 'peak hour', color: '#ffd166' } : { value: user.followers, label: 'followers', color: '#ffd166' },
  ];
  const host = location.host + location.pathname.replace(/\/$/, '');

  const card = (
    <div className="sc" ref={exportRef} style={{ '--p': persona.color }}>
      <div className="sc-glow" />
      <header className="sc-head">
        <img src={user.avatar} alt="" />
        <div>
          <p className="sc-name">{user.name}</p>
          <p className="sc-handle">@{user.login}</p>
        </div>
        <p className="sc-year">{year}<br /><span>GitHub Wrapped</span></p>
      </header>
      <div className="sc-persona">
        <span className="sc-emoji">{persona.emoji}</span>
        <div>
          <p className="sc-label">Developer personality</p>
          <p className="sc-ptitle">{persona.title}</p>
        </div>
      </div>
      <div className="sc-grid">{stats.map((s) => <Stat key={s.label} {...s} />)}</div>
      {langs.list.length > 0 && (
        <div className="sc-langs">
          <div className="sc-bar">{langs.list.slice(0, 6).map((l) => <i key={l.name} style={{ flex: l.pct, background: l.color }} />)}</div>
          <p>{langs.list.slice(0, 4).map((l) => `${l.name} ${l.pct}%`).join('  ·  ')}</p>
        </div>
      )}
      {cal && cal.total > 0 && (
        <div className="sc-heat">{cal.heatmap.flatMap((week, w) => week.map((lvl, r) => <i key={`${w}-${r}`} className={`l${lvl}`} />))}</div>
      )}
      <footer className="sc-foot">Get yours → <b>{host}</b></footer>
    </div>
  );

  if (exportRef) return card;
  return (
    <div className="sc-fit" ref={wrap}>
      <div style={{ width: W * scale, height: H * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: W, height: H }}>{card}</div>
      </div>
    </div>
  );
}

async function renderPng(node) {
  const opts = { width: W, height: H, pixelRatio: 1, cacheBust: true, backgroundColor: '#0b0a14' };
  try { return await toBlob(node, opts); }
  catch { return toBlob(node, { ...opts, skipFonts: true }); } // cross-origin font CSS can fail in some browsers
}

export function ShareActions({ data }) {
  const exportNode = useRef(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const url = shareUrl(data);
  const file = `github-wrapped-${data.user.login}-${data.year}.png`;
  const text = `My ${data.year} on GitHub: ${data.persona.emoji} ${data.persona.title}${data.cal ? `, ${data.cal.total.toLocaleString()} contributions and a ${data.cal.longestStreak}-day streak` : ''}. Get your own GitHub Wrapped 👇`;

  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 2500); };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderPng(exportNode.current);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash('Saved! Post it on LinkedIn ✨');
    } catch { flash('Could not create the image. Try a screenshot.'); }
    setBusy(false);
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderPng(exportNode.current);
      const f = new File([blob], file, { type: 'image/png' });
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text: `${text} ${url}` });
      else if (navigator.share) await navigator.share({ title: 'GitHub Wrapped', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); flash('Caption + link copied!'); }
    } catch (e) { if (e?.name !== 'AbortError') flash('Sharing isn’t available here — use Download.'); }
    setBusy(false);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); flash('Link copied!'); } catch { flash(url); }
  };

  return (
    <div className="actions rise d3">
      <button type="button" className="primary" onClick={download} disabled={busy}>{busy ? 'Making image…' : '⬇ Download card'}</button>
      <div className="row">
        <button type="button" onClick={share} disabled={busy}>📤 Share</button>
        <a className="btn" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">in LinkedIn</a>
        <button type="button" onClick={copy}>🔗 Copy link</button>
      </div>
      <p className="note" aria-live="polite">{note}</p>
      <div className="offscreen" aria-hidden="true"><ShareCard data={data} exportRef={exportNode} /></div>
    </div>
  );
}
