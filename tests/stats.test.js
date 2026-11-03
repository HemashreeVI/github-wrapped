import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarStats, languageStats, repoStats, rhythmStats, personality, computeWrapped, formatHour } from '../src/lib/stats.js';

const day = (date, count) => ({ date, count, level: count ? 1 : 0 });

test('calendar: totals, best day, busiest month', () => {
  const s = calendarStats([day('2026-01-01', 2), day('2026-01-02', 5), day('2026-02-10', 1), day('2025-12-31', 99)], 2026, '2026-03-01');
  assert.equal(s.total, 8);
  assert.equal(s.activeDays, 3);
  assert.equal(s.best.date, '2026-01-02');
  assert.equal(s.busiestMonth, 0);
});

test('calendar: longest streak spans month boundary, ignores future days', () => {
  const days = [day('2026-01-30', 1), day('2026-01-31', 1), day('2026-02-01', 1), day('2026-02-03', 1), day('2026-12-01', 50)];
  const s = calendarStats(days, 2026, '2026-06-01');
  assert.equal(s.longestStreak, 3);
  assert.equal(s.total, 4);
});

test('calendar: current streak survives an empty today', () => {
  const days = [day('2026-05-08', 1), day('2026-05-09', 3), day('2026-05-10', 0)];
  assert.equal(calendarStats(days, 2026, '2026-05-10').currentStreak, 2);
  assert.equal(calendarStats([...days.slice(0, 2), day('2026-05-10', 1)], 2026, '2026-05-10').currentStreak, 3);
});

test('calendar: heatmap is 7 rows starting on Sunday', () => {
  const s = calendarStats([day('2026-01-01', 4), day('2026-01-02', 1)], 2026, '2026-01-02');
  assert.ok(s.heatmap.every((w) => w.length === 7));
  // Jan 1 2026 is a Thursday → first 4 cells are outside the year
  assert.deepEqual(s.heatmap[0].slice(0, 4), [-1, -1, -1, -1]);
  assert.equal(s.heatmap[0][4], 4);
});

test('calendar: empty input → null', () => {
  assert.equal(calendarStats(null, 2026, '2026-01-01'), null);
  assert.equal(calendarStats([], 2026, '2026-01-01'), null);
});

const repo = (o) => ({ fork: false, stargazers_count: 0, forks_count: 0, created_at: '2024-01-01T00:00:00Z', pushed_at: '2026-04-01T00:00:00Z', ...o });

test('languages: forks excluded, sorted by repo count', () => {
  const l = languageStats([repo({ language: 'Python' }), repo({ language: 'Python' }), repo({ language: 'Go' }), repo({ language: 'Rust', fork: true })], 2026);
  assert.deepEqual(l.list.map((x) => x.name), ['Python', 'Go']);
  assert.equal(l.list[0].pct, 67);
});

test('repos: stars, new repos, top repo', () => {
  const r = repoStats([repo({ name: 'a', stargazers_count: 3 }), repo({ name: 'b', stargazers_count: 10, created_at: '2026-02-01T00:00:00Z' }), repo({ name: 'c', fork: true, stargazers_count: 500 })], 2026);
  assert.equal(r.totalStars, 13);
  assert.equal(r.newRepos, 1);
  assert.equal(r.top.name, 'b');
});

test('rhythm: peak hour and night share (UTC)', () => {
  const ev = (iso, type = 'PushEvent') => ({ type, created_at: iso });
  const r = rhythmStats([ev('2026-03-01T23:10:00Z'), ev('2026-03-02T23:40:00Z'), ev('2026-03-03T10:00:00Z', 'PullRequestEvent'), ev('2025-12-31T23:00:00Z')], 2026, new Date('2026-03-04T00:00:00Z'));
  assert.equal(r.total, 3);
  assert.equal(r.peakHour, 23);
  assert.ok(Math.abs(r.nightShare - 2 / 3) < 1e-9);
  assert.equal(r.kinds[0].label, 'pushes');
});

test('personality: strongest signal wins, explorer as fallback', () => {
  const base = { cal: null, langs: { count: 1 }, repos: { newRepos: 0, totalStars: 0 }, rhythm: null };
  assert.equal(personality(base).id, 'explorer');
  assert.equal(personality({ ...base, langs: { count: 7 } }).id, 'polyglot');
  assert.equal(personality({ ...base, langs: { count: 6 }, cal: { longestStreak: 40 } }).id, 'marathoner');
});

test('computeWrapped works with no calendar and no events', () => {
  const w = computeWrapped({ user: { login: 'x' }, repos: [repo({ language: 'C' })], year: 2026, now: new Date('2026-11-03T12:00:00Z') });
  assert.equal(w.cal, null);
  assert.equal(w.rhythm, null);
  assert.equal(w.user.name, 'x');
  assert.equal(w.langs.list[0].name, 'C');
});

test('formatHour', () => {
  assert.equal(formatHour(0), '12 AM');
  assert.equal(formatHour(13), '1 PM');
  assert.equal(formatHour(12), '12 PM');
});
