// Pure functions: raw GitHub data in, "wrapped" story data out.
// No React, no fetch — so it is easy to unit test (see tests/stats.test.js).

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c',
  Shell: '#89e051', 'Jupyter Notebook': '#DA5B0B', Vue: '#41b883', Svelte: '#ff3e00', Lua: '#000080',
  R: '#198CE7', Scala: '#c22d40', Elixir: '#6e4a7e', Haskell: '#5e5086', Zig: '#ec915c', Astro: '#ff5a03',
  MDX: '#fcb32c', Solidity: '#AA6746', 'Objective-C': '#438eff', Perl: '#0298c3', Julia: '#a270ba',
};
export const langColor = (name) => LANG_COLORS[name] || '#9aa4b2';

export function formatHour(h) {
  const suffix = h < 12 ? 'AM' : 'PM';
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n} ${suffix}`;
}

export function localISODate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const dayDiff = (a, b) => Math.round((Date.UTC(...b.split('-').map((v, i) => (i === 1 ? v - 1 : +v))) - Date.UTC(...a.split('-').map((v, i) => (i === 1 ? v - 1 : +v)))) / 86400000);

/** Contribution calendar → totals, streaks, best day, busiest month, heatmap weeks. */
export function calendarStats(days, year, today) {
  if (!Array.isArray(days) || days.length === 0) return null;
  const inYear = days
    .filter((d) => d.date.startsWith(`${year}-`) && d.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (inYear.length === 0) return null;

  let total = 0, activeDays = 0, best = null, longest = 0, run = 0, prevActive = null;
  let longestEnd = null;
  const months = Array(12).fill(0);
  for (const d of inYear) {
    total += d.count;
    months[+d.date.slice(5, 7) - 1] += d.count;
    if (d.count > 0) {
      activeDays++;
      if (!best || d.count > best.count) best = d;
      run = prevActive && dayDiff(prevActive, d.date) === 1 ? run + 1 : 1;
      prevActive = d.date;
      if (run > longest) { longest = run; longestEnd = d.date; }
    }
  }
  // Current streak: counts back from today (or yesterday, so an un-pushed today doesn't break it).
  let current = 0;
  const byDate = new Map(inYear.map((d) => [d.date, d.count]));
  const cursor = new Date(`${today}T12:00:00`);
  if (!byDate.get(today)) cursor.setDate(cursor.getDate() - 1);
  while (byDate.get(localISODate(cursor)) > 0) { current++; cursor.setDate(cursor.getDate() - 1); }

  const busiestMonth = months.indexOf(Math.max(...months));
  const max = Math.max(1, ...inYear.map((d) => d.count));
  return {
    total, activeDays, best, longestStreak: longest, longestStreakEnd: longestEnd, currentStreak: current,
    months, busiestMonth: total > 0 ? busiestMonth : null,
    heatmap: buildHeatmap(inYear, year, max),
  };
}

/** Weeks (columns) × 7 days (rows), starting on the Sunday on/before Jan 1. Level 0–4. */
function buildHeatmap(days, year, max) {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const last = days[days.length - 1].date;
  const start = new Date(`${year}-01-01T12:00:00`);
  start.setDate(start.getDate() - start.getDay());
  const weeks = [];
  const cur = new Date(start);
  while (localISODate(cur) <= last) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const iso = localISODate(cur);
      const inRange = iso.startsWith(`${year}-`) && iso <= last;
      const c = counts.get(iso) || 0;
      week.push(inRange ? (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4))) : -1);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function languageStats(repos, year) {
  const own = repos.filter((r) => !r.fork);
  const touched = own.filter((r) => (r.pushed_at || '').startsWith(`${year}`) || (r.created_at || '').startsWith(`${year}`));
  const pool = touched.length ? touched : own;
  const counts = {};
  for (const r of pool) if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const list = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => ({ name, repos: n, pct: Math.round((n / total) * 100), color: langColor(name) }));
  return { list, count: list.length };
}

export function repoStats(repos, year) {
  const own = repos.filter((r) => !r.fork);
  const totalStars = own.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  const newRepos = own.filter((r) => (r.created_at || '').startsWith(`${year}`));
  const ranked = [...own].sort((a, b) => (b.stargazers_count - a.stargazers_count) || ((b.pushed_at || '') > (a.pushed_at || '') ? 1 : -1));
  const top = ranked[0]
    ? { name: ranked[0].name, stars: ranked[0].stargazers_count || 0, forks: ranked[0].forks_count || 0, language: ranked[0].language, description: ranked[0].description }
    : null;
  return { totalStars, newRepos: newRepos.length, top, ownCount: own.length };
}

const EVENT_LABELS = {
  PushEvent: 'pushes', PullRequestEvent: 'pull requests', IssuesEvent: 'issues', IssueCommentEvent: 'comments',
  PullRequestReviewEvent: 'reviews', PullRequestReviewCommentEvent: 'reviews', CreateEvent: 'branches & repos', WatchEvent: 'stars given', ForkEvent: 'forks',
};

export function rhythmStats(events, year, now) {
  const mine = events.filter((e) => (e.created_at || '').startsWith(`${year}`));
  if (mine.length === 0) return null;
  const hours = Array(24).fill(0), weekdays = Array(7).fill(0), kinds = {};
  let oldest = now;
  for (const e of mine) {
    const d = new Date(e.created_at);
    hours[d.getHours()]++;
    weekdays[d.getDay()]++;
    const label = EVENT_LABELS[e.type];
    if (label) kinds[label] = (kinds[label] || 0) + 1;
    if (d < oldest) oldest = d;
  }
  const n = mine.length;
  const share = (idx) => idx.reduce((s, i) => s + hours[i], 0) / n;
  return {
    total: n, hours, weekdays,
    peakHour: hours.indexOf(Math.max(...hours)),
    peakDay: weekdays.indexOf(Math.max(...weekdays)),
    nightShare: share([22, 23, 0, 1, 2, 3, 4]),
    morningShare: share([5, 6, 7, 8, 9]),
    weekendShare: (weekdays[0] + weekdays[6]) / n,
    collabShare: ((kinds['pull requests'] || 0) + (kinds.reviews || 0) + (kinds.comments || 0)) / n,
    kinds: Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    windowDays: Math.max(1, Math.ceil((now - oldest) / 86400000)),
  };
}

export const PERSONAS = {
  nightOwl: { emoji: '🦉', title: 'The Night Owl', line: 'While the world sleeps, you ship.', color: '#6c5ce7' },
  earlyBird: { emoji: '🌅', title: 'The Early Bird', line: 'Commits before coffee. Respect.', color: '#ff9f43' },
  marathoner: { emoji: '🏃', title: 'The Marathoner', line: 'Day after day, you just keep showing up.', color: '#ff4757' },
  polyglot: { emoji: '🌍', title: 'The Polyglot', line: 'Why pick one language when you can speak them all?', color: '#1abc9c' },
  builder: { emoji: '🏗️', title: 'The Builder', line: 'New idea? New repo. You never stop starting.', color: '#f7b731' },
  risingStar: { emoji: '⭐', title: 'The Rising Star', line: 'People notice what you build.', color: '#fdcb6e' },
  weekendWarrior: { emoji: '🛡️', title: 'The Weekend Warrior', line: 'Saturdays are for side projects.', color: '#e84393' },
  collaborator: { emoji: '🤝', title: 'The Collaborator', line: 'PRs, reviews, comments — you make teams better.', color: '#0984e3' },
  explorer: { emoji: '🌱', title: 'The Explorer', line: 'Your journey is just getting started.', color: '#20bf6b' },
};

/** Score each archetype against a threshold; the strongest ratio wins. */
export function personality({ cal, langs, repos, rhythm }) {
  const scores = {
    nightOwl: rhythm && rhythm.total >= 10 ? rhythm.nightShare / 0.35 : 0,
    earlyBird: rhythm && rhythm.total >= 10 ? rhythm.morningShare / 0.3 : 0,
    weekendWarrior: rhythm && rhythm.total >= 10 ? rhythm.weekendShare / 0.4 : 0,
    collaborator: rhythm && rhythm.total >= 10 ? rhythm.collabShare / 0.35 : 0,
    marathoner: cal ? cal.longestStreak / 14 : 0,
    polyglot: langs.count / 5,
    builder: repos.newRepos / 8,
    risingStar: repos.totalStars / 50,
  };
  const [key, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const id = score >= 1 ? key : 'explorer';
  return { id, ...PERSONAS[id] };
}

export function computeWrapped({ user, repos = [], events = [], calendar = null, year, now = new Date() }) {
  const today = localISODate(now);
  const cal = calendarStats(calendar, year, today);
  const langs = languageStats(repos, year);
  const repoInfo = repoStats(repos, year);
  const rhythm = rhythmStats(events, year, now);
  return {
    year,
    user: {
      login: user.login, name: user.name || user.login, avatar: user.avatar_url,
      followers: user.followers || 0, publicRepos: user.public_repos || 0,
      joinedYear: user.created_at ? +user.created_at.slice(0, 4) : null,
    },
    cal, langs, repos: repoInfo, rhythm,
    persona: personality({ cal, langs, repos: repoInfo, rhythm }),
  };
}
