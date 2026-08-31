import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) setError(error.message);
  }

  async function sendReset() {
    if (!email.trim()) {
      setError('Enter your email above first.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setResetSent(true);
  }

  return (
    <div className="center">
      <span className="wordmark">
        Triple Jeopardy
        <span className="firm">Positive Force FL</span>
      </span>
      <h1>Sign in</h1>

      {resetSent ? (
        <p className="sub">
          Check your email for a link to set your password, then come back here.
        </p>
      ) : (
        <form onSubmit={signIn}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="notice error">{error}</p>}

          <div className="btnrow">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>

          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 16 }}>
            First time, or forgot it?{' '}
            <button
              type="button"
              onClick={() => void sendReset()}
              disabled={busy}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brick)',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Email me a link to set my password
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
