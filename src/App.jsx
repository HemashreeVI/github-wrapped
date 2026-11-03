import { useCallback, useEffect, useState } from 'react';
import Landing from './components/Landing.jsx';
import Story from './components/Story.jsx';
import { fetchGitHubYear } from './lib/github.js';
import { computeWrapped } from './lib/stats.js';

const now = new Date();
// In early January people want the year that just ended.
const DEFAULT_YEAR = now.getMonth() === 0 && now.getDate() < 20 ? now.getFullYear() - 1 : now.getFullYear();

function readParams() {
  const p = new URLSearchParams(location.search);
  const y = +p.get('y');
  return { user: p.get('u') || '', year: y >= 2008 && y <= now.getFullYear() ? y : DEFAULT_YEAR };
}

export default function App() {
  const [{ user: initialUser, year }] = useState(readParams);
  const [state, setState] = useState({ view: initialUser ? 'loading' : 'landing' });
  const [step, setStep] = useState('');
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem('gw:token') || ''; } catch { return ''; } });

  const wrap = useCallback(async (username, tok = token) => {
    setState({ view: 'loading', username });
    try {
      const raw = await fetchGitHubYear(username, { year, token: tok, onStep: setStep });
      const data = computeWrapped({ ...raw, year });
      const url = new URL(location.href);
      url.searchParams.set('u', data.user.login);
      if (year !== DEFAULT_YEAR) url.searchParams.set('y', year); else url.searchParams.delete('y');
      history.replaceState(null, '', url);
      document.title = `${data.user.name}’s ${year} on GitHub — Wrapped`;
      setState({ view: 'story', data });
    } catch (error) {
      setState({ view: 'landing', error, username });
    }
  }, [token, year]);

  useEffect(() => { if (initialUser) wrap(initialUser); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveToken = (t) => {
    setToken(t);
    try { t ? sessionStorage.setItem('gw:token', t) : sessionStorage.removeItem('gw:token'); } catch { /* ignore */ }
  };

  const home = () => {
    history.replaceState(null, '', location.pathname);
    document.title = 'GitHub Wrapped — your coding year as a story';
    setState({ view: 'landing' });
  };

  if (state.view === 'story') return <Story data={state.data} onExit={home} />;
  if (state.view === 'loading') {
    return (
      <main className="loading" aria-live="polite">
        <div className="tape"><span /><span /><span /></div>
        <p className="loading-title">Rewinding your {year}…</p>
        <p className="loading-step">{step || 'Warming up'}</p>
      </main>
    );
  }
  return <Landing year={year} onSubmit={wrap} error={state.error} lastUser={state.username} token={token} onToken={saveToken} />;
}
