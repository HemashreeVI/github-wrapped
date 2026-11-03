import { useState } from 'react';

const EXAMPLES = ['torvalds', 'gaearon', 'sindresorhus', 'HemashreeVI'];

function errorText(error) {
  if (!error) return null;
  if (error.kind === 'rateLimit' && error.reset) {
    const mins = Math.max(1, Math.ceil((error.reset - Date.now()) / 60000));
    return `${error.message} Try again in about ${mins} min, or add a token below.`;
  }
  return error.message;
}

export default function Landing({ year, onSubmit, error, lastUser = '', token, onToken }) {
  const [name, setName] = useState(lastUser);
  const [showToken, setShowToken] = useState(error?.kind === 'rateLimit' || error?.kind === 'token');
  const submit = (e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); };

  return (
    <main className="landing">
      <div className="blobs" aria-hidden="true"><i /><i /><i /></div>
      <section className="hero">
        <p className="eyebrow">GitHub Wrapped · {year}</p>
        <h1>Your year in code,<br /><span className="grad">wrapped.</span></h1>
        <p className="lede">Contributions, streaks, top languages, the hour you code most — and the developer personality that says it all. One username. No login.</p>

        <form className="search" onSubmit={submit}>
          <label htmlFor="u" className="prefix">github.com/</label>
          <input id="u" value={name} onChange={(e) => setName(e.target.value)} placeholder="username" autoComplete="off" autoCapitalize="off" spellCheck="false" autoFocus />
          <button type="submit" disabled={!name.trim()}>Wrap it 🎁</button>
        </form>

        {error && <p className="error" role="alert">{errorText(error)}</p>}

        <div className="examples">
          <span>Try:</span>
          {EXAMPLES.map((u) => <button key={u} type="button" onClick={() => onSubmit(u)}>@{u}</button>)}
        </div>

        <button type="button" className="linkish" onClick={() => setShowToken((s) => !s)}>
          {showToken ? 'Hide token' : 'Hit the rate limit?'}
        </button>
        {showToken && (
          <div className="token">
            <input type="password" value={token} onChange={(e) => onToken(e.target.value.trim())} placeholder="ghp_… (optional, no scopes needed)" aria-label="GitHub token" />
            <p>A token with <b>no scopes</b> raises GitHub’s limit from 60 to 5,000 requests an hour. It stays in this tab only and is sent to GitHub, nowhere else.</p>
          </div>
        )}
      </section>

      <ul className="teasers" aria-hidden="true">
        <li style={{ '--c': '#1ed760' }}><b>1,284</b><span>contributions</span></li>
        <li style={{ '--c': '#ff6b3d' }}><b>🔥 23</b><span>day streak</span></li>
        <li style={{ '--c': '#7c4dff' }}><b>🦉</b><span>The Night Owl</span></li>
        <li style={{ '--c': '#ffd166' }}><b>11 PM</b><span>peak hour</span></li>
      </ul>

      <footer className="foot">
        Uses GitHub’s public API. Nothing is stored on a server. ·{' '}
        <a href="https://github.com/HemashreeVI/github-wrapped" target="_blank" rel="noreferrer">Source</a>
      </footer>
    </main>
  );
}
