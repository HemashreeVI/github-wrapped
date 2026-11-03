import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSlides } from './slides.jsx';

const DURATION = 6500;

/** Instagram-style story: progress bars, tap left/right, hold to pause, arrow keys. */
export default function Story({ data, onExit }) {
  const slides = useMemo(() => buildSlides(data), [data]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const holdTimer = useRef(null);
  const held = useRef(false);
  const last = index === slides.length - 1;

  const go = useCallback((delta) => {
    setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + delta)));
    elapsed.current = 0;
    setProgress(0);
  }, [slides.length]);

  useEffect(() => {
    if (paused || last) { if (last) setProgress(1); return; }
    let prev = performance.now(), raf;
    const tick = (t) => {
      elapsed.current += t - prev; prev = t;
      if (elapsed.current >= DURATION) { go(1); return; }
      setProgress(elapsed.current / DURATION);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, last, go]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input,textarea')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === 'Escape') onExit();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [go, onExit]);

  const onDown = (e) => {
    if (e.target.closest('button,a,input')) return;
    held.current = false;
    holdTimer.current = setTimeout(() => { held.current = true; setPaused(true); }, 220);
  };
  const onUp = (e) => {
    clearTimeout(holdTimer.current);
    if (e.target.closest('button,a,input')) return;
    if (held.current) { setPaused(false); return; }
    const { left, width } = e.currentTarget.getBoundingClientRect();
    go(e.clientX - left < width * 0.3 ? -1 : 1);
  };

  const slide = slides[index];
  return (
    <div className="stage" style={{ '--bg': slide.bg, '--ink': slide.ink || '#fff' }}>
      <div className="story" onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => clearTimeout(holdTimer.current)}>
        <div className="bars" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.id}><i style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} /></span>
          ))}
        </div>
        <div className="story-top">
          <img src={data.user.avatar} alt="" />
          <span>@{data.user.login} · {data.year}</span>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? '▶' : '❚❚'}</button>
          <button type="button" onClick={onExit} aria-label="Close">✕</button>
        </div>
        <section className={`slide slide-${slide.id}`} key={slide.id} aria-live="polite">
          {slide.render()}
        </section>
        {!last && index === 0 && <p className="hint">Tap to continue →</p>}
      </div>
    </div>
  );
}
