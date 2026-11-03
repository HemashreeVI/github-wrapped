// Fetches everything a wrap needs from public, key-less APIs and caches it for an hour.

const API = 'https://api.github.com';
const CONTRIB_API = 'https://github-contributions-api.jogruber.de/v4';
const CACHE_MS = 60 * 60 * 1000;

export class WrapError extends Error {
  constructor(kind, message, extra = {}) { super(message); this.kind = kind; Object.assign(this, extra); }
}

async function gh(path, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try { res = await fetch(`${API}${path}`, { headers }); }
  catch { throw new WrapError('network', 'Could not reach GitHub. Check your connection and try again.'); }
  if (res.status === 404) throw new WrapError('notFound', 'No GitHub user with that name.');
  if (res.status === 401) throw new WrapError('token', 'That token was rejected by GitHub.');
  if (res.status === 403 || res.status === 429) {
    const reset = +res.headers.get('x-ratelimit-reset') * 1000 || null;
    throw new WrapError('rateLimit', 'GitHub’s free limit (60 requests an hour) is used up on this network.', { reset });
  }
  if (!res.ok) throw new WrapError('http', `GitHub answered ${res.status}.`);
  return res.json();
}

async function pages(path, token, max) {
  const out = [];
  for (let page = 1; page <= max; page++) {
    let batch;
    try { batch = await gh(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, token); }
    catch (e) { if (page === 1) throw e; break; } // events API stops at 300 items — later pages may 422
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function contributions(login, year) {
  try {
    const res = await fetch(`${CONTRIB_API}/${encodeURIComponent(login)}?y=${year}`);
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.contributions) ? json.contributions : null;
  } catch { return null; }
}

/** Avatar as a data URL so the share card can be exported to PNG without CORS trouble. */
async function avatarData(url) {
  try {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}s=240`);
    const blob = await res.blob();
    return await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
  } catch { return url; }
}

const slim = (r) => ({
  name: r.name, fork: r.fork, language: r.language, stargazers_count: r.stargazers_count,
  forks_count: r.forks_count, created_at: r.created_at, pushed_at: r.pushed_at, description: r.description,
});

export async function fetchGitHubYear(username, { year, token, onStep = () => {} }) {
  const login = username.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) throw new WrapError('invalid', 'That doesn’t look like a GitHub username.');

  const key = `gw:${login.toLowerCase()}:${year}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  } catch { /* storage unavailable */ }

  onStep('Finding your profile');
  const user = await gh(`/users/${login}`, token);
  onStep('Counting your contributions');
  const [repos, events, calendar, avatar] = await Promise.all([
    pages(`/users/${user.login}/repos?type=owner&sort=pushed`, token, 3),
    pages(`/users/${user.login}/events/public`, token, 3).catch(() => []),
    contributions(user.login, year),
    avatarData(user.avatar_url),
  ]);
  onStep('Wrapping it up');
  const data = {
    user: { login: user.login, name: user.name, avatar_url: avatar, followers: user.followers, public_repos: user.public_repos, created_at: user.created_at },
    repos: repos.map(slim),
    events: events.map((e) => ({ type: e.type, created_at: e.created_at })),
    calendar,
  };
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* quota or private mode */ }
  return data;
}
