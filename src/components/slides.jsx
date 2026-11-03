import { useEffect, useState } from 'react';
import { DAYS, MONTHS, formatHour } from '../lib/stats.js';
import ShareCard, { ShareActions } from './ShareCard.jsx';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function CountUp({ to, ms = 1600, delay = 250 }) {
  const [v, setV] = useState(reduced() ? to : 0);
  useEffect(() => {
    if (reduced()) return;
    let raf, start;
    const t0 = setTimeout(() => {
      const step = (t) => {
        start ??= t;
        const k = Math.min(1, (t - start) / ms);
        setV(Math.round(to * (1 - Math.pow(1 - k, 4))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [to, ms, delay]);
  return <>{v.toLocaleString()}</>;
}

const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

function streakLine(n) {
  if (n >= 100) return 'That’s not a streak. That’s a lifestyle.';
  if (n >= 30) return 'A whole month without missing a day. Unreal.';
  if (n >= 14) return 'Two weeks straight. Consistency is your superpower.';
  if (n >= 7) return 'A full week of showing up. Nice rhythm.';
  return 'Every streak starts with day one.';
}

function hourLine(h) {
  if (h >= 22 || h < 5) return 'Night mode: on. The bugs fear you after dark. 🌙';
  if (h < 10) return 'Up with the sun and already pushing code. ☀️';
  if (h < 17) return 'Classic daytime dev — focused hours, clean commits. 💼';
  return 'Evenings are for building. 🌆';
}

/** Each slide: id, background, optional ink colour, render(). Slides without data are skipped. */
export function buildSlides(d) {
  const { user, year, cal, langs, repos, rhythm, persona } = d;
  const s = [];

  s.push({
    id: 'intro', bg: 'linear-gradient(160deg,#ff4fd8 0%,#7c4dff 55%,#2b1a6b 100%)',
    render: () => (
      <>
        <img className="intro-avatar pop" src={user.avatar} alt="" />
        <p className="kicker rise d1">Hey {user.name.split(' ')[0]} 👋</p>
        <h2 className="mega rise d2">Let’s rewind your <span className="hl">{year}</span> on GitHub.</h2>
        {user.joinedYear && <p className="sub rise d3">You’ve been here since {user.joinedYear}. Let’s see what this year looked like.</p>}
      </>
    ),
  });

  if (cal) {
    s.push({
      id: 'total', bg: 'radial-gradient(120% 80% at 50% 100%,#1ed760 0%,#0b3d22 60%,#06140c 100%)',
      render: () => (
        <>
          <p className="kicker rise d1">This year you made</p>
          <h2 className="giant pop d2"><CountUp to={cal.total} /></h2>
          <p className="big rise d3">contributions</p>
          <p className="sub rise d4">across {plural(cal.activeDays, 'active day')}{cal.activeDays ? ` — about ${(cal.total / cal.activeDays).toFixed(1)} a day when you showed up` : ''}.</p>
        </>
      ),
    });
  }

  if (cal && cal.total > 0) {
    s.push({
      id: 'heatmap', bg: 'linear-gradient(180deg,#0d1b2a 0%,#0b2a1e 100%)',
      render: () => (
        <>
          <p className="kicker rise d1">Your year, one square at a time</p>
          <div className="heat rise d2" style={{ gridTemplateColumns: `repeat(${cal.heatmap.length}, 1fr)` }}>
            {cal.heatmap.map((week, w) => week.map((lvl, r) => (
              <i key={`${w}-${r}`} className={`l${lvl}`} style={{ gridColumn: w + 1, gridRow: r + 1, animationDelay: `${300 + w * 22}ms` }} />
            )))}
          </div>
          {cal.best && <p className="big rise d3">Best day: <span className="hl-green">{fmtDate(cal.best.date)}</span></p>}
          <p className="sub rise d4">
            {plural(cal.best?.count || 0, 'contribution')} in a single day.
            {cal.busiestMonth !== null && <> {MONTHS[cal.busiestMonth]} was your busiest month.</>}
          </p>
        </>
      ),
    });
  }

  if (cal && cal.longestStreak > 0) {
    s.push({
      id: 'streak', bg: 'radial-gradient(110% 70% at 50% 90%,#ffb03b 0%,#ff4b2b 45%,#5a0f1c 100%)',
      render: () => (
        <>
          <div className="flame pop d1" aria-hidden="true">🔥</div>
          <p className="kicker rise d2">Your longest streak</p>
          <h2 className="giant pop d3"><CountUp to={cal.longestStreak} ms={1200} /></h2>
          <p className="big rise d3">days in a row</p>
          <p className="sub rise d4">{streakLine(cal.longestStreak)}{cal.currentStreak > 1 ? ` You’re on a ${cal.currentStreak}-day run right now.` : ''}</p>
        </>
      ),
    });
  }

  if (langs.count) {
    const top = langs.list.slice(0, 5);
    s.push({
      id: 'langs', bg: 'linear-gradient(165deg,#1e3cff 0%,#1a1446 70%)',
      render: () => (
        <>
          <p className="kicker rise d1">You spoke {plural(langs.count, 'language')}</p>
          <h2 className="mega rise d2">But <span style={{ color: top[0].color }}>{top[0].name}</span> was your favourite.</h2>
          <ol className="langbars">
            {top.map((l, i) => (
              <li key={l.name} className="rise" style={{ animationDelay: `${700 + i * 140}ms` }}>
                <span className="lname">{i + 1}. {l.name}</span>
                <span className="track"><i style={{ '--w': `${Math.max(6, l.pct)}%`, background: l.color, animationDelay: `${850 + i * 140}ms` }} /></span>
                <span className="pct">{l.pct}%</span>
              </li>
            ))}
          </ol>
          <p className="sub rise d5">Share of repos you worked on this year.</p>
        </>
      ),
    });
  }

  if (rhythm && rhythm.total >= 5) {
    const max = Math.max(...rhythm.hours);
    const night = rhythm.peakHour >= 20 || rhythm.peakHour < 5;
    s.push({
      id: 'rhythm', bg: night ? 'linear-gradient(180deg,#05051a 0%,#241a5e 100%)' : 'linear-gradient(180deg,#ffcf6b 0%,#ff7a59 100%)', ink: night ? '#fff' : '#1b0f2a',
      render: () => (
        <>
          <p className="kicker rise d1">You code most at</p>
          <h2 className="giant pop d2">{formatHour(rhythm.peakHour)}</h2>
          <p className="big rise d3">on {DAYS[rhythm.peakDay]}s</p>
          <div className="clock rise d3" aria-hidden="true" style={{ '--peak': night ? '#ffd166' : '#1b0f2a' }}>
            {rhythm.hours.map((n, h) => (
              <i key={h} className={h === rhythm.peakHour ? 'peak' : ''} style={{ height: `${8 + (n / max) * 92}%`, animationDelay: `${600 + h * 35}ms` }} />
            ))}
          </div>
          <div className="clock-axis" aria-hidden="true"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span></div>
          <p className="sub rise d5">{hourLine(rhythm.peakHour)}</p>
          <p className="fine rise d5">Based on your last {rhythm.windowDays} days of public activity.</p>
        </>
      ),
    });
  }

  if (repos.ownCount) {
    s.push({
      id: 'repos', bg: 'linear-gradient(160deg,#ffe066 0%,#ffb703 100%)', ink: '#1d1300',
      render: () => (
        <>
          <p className="kicker rise d1">You started</p>
          <h2 className="giant pop d2"><CountUp to={repos.newRepos} ms={1000} /></h2>
          <p className="big rise d3">new {repos.newRepos === 1 ? 'repo' : 'repos'} this year</p>
          {repos.top && (
            <div className="repo-card rise d4">
              <p className="fine">Your most-starred project</p>
              <p className="repo-name">📦 {repos.top.name}</p>
              {repos.top.description && <p className="repo-desc">{repos.top.description}</p>}
              <p className="repo-meta">⭐ {repos.top.stars.toLocaleString()} · 🍴 {repos.top.forks.toLocaleString()}{repos.top.language ? ` · ${repos.top.language}` : ''}</p>
            </div>
          )}
          <p className="sub rise d5">{plural(repos.totalStars, 'star')} across all your repos.</p>
        </>
      ),
    });
  }

  s.push({
    id: 'persona', bg: `radial-gradient(120% 90% at 50% 30%, ${persona.color} 0%, #120b24 75%)`,
    render: () => (
      <>
        <p className="kicker rise d1">Your developer personality is…</p>
        <div className="persona-emoji reveal d2" aria-hidden="true">{persona.emoji}</div>
        <h2 className="mega reveal d3">{persona.title}</h2>
        <p className="big rise d4">{persona.line}</p>
      </>
    ),
  });

  s.push({
    id: 'summary', bg: 'linear-gradient(180deg,#151026 0%,#0b0a14 100%)',
    render: () => (
      <>
        <p className="kicker rise d1">That’s a wrap! Share your year 🎁</p>
        <div className="card-preview rise d2"><ShareCard data={d} /></div>
        <ShareActions data={d} />
      </>
    ),
  });

  return s;
}
