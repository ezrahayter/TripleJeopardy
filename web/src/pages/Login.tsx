import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="center">
      <span className="wordmark">
        Triple Jeopardy
        <span className="firm">Positive Force FL</span>
      </span>
      <h1>Sign in</h1>
      {sent ? (
        <p className="sub">Check your email for a magic link, then come back here.</p>
      ) : (
        <form onSubmit={send}>
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@campaign.org"
          />
          {error && <p className="notice error">{error}</p>}
          <div className="btnrow">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
