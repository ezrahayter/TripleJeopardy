import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="center">
      <span className="wordmark">
        Triple Jeopardy
        <span className="firm">Positive Force FL</span>
      </span>
      <h1>Set your password</h1>
      <p className="sub">Pick a password for your account, then you’re in.</p>
      <form onSubmit={submit}>
        <label htmlFor="pw">New password</label>
        <input
          id="pw"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label htmlFor="pw2">Confirm password</label>
        <input
          id="pw2"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="notice error">{error}</p>}
        <div className="btnrow">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
