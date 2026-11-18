import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from './firebase';

export default function AuthModal({
  close,
  success,
  initialMode = 'signin',
}: {
  close: () => void;
  success: () => void;
  initialMode?: 'signin' | 'signup';
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Temporary native sign-in diagnostic.
  // Once native login is working, we can remove this.
  const [stage, setStage] = useState('');

  async function submit() {
    if (mode === 'signup' && password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }

    setBusy(true);
    setMessage('');
    setStage('1/3 Contacting Firebase…');

    try {
      const authPromise =
        mode === 'signup'
          ? createUserWithEmailAndPassword(auth, email, password)
          : signInWithEmailAndPassword(auth, email, password);

      // Do not let native Piper sit on "Working…" forever.
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error('AUTH_TIMEOUT_AFTER_15_SECONDS'));
        }, 15000);
      });

      await Promise.race([authPromise, timeoutPromise]);

      setStage('2/3 Signed in. Loading kitchen…');

      // Give React a moment to paint the stage before Piper starts
      // whatever post-login initialization is in success().
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 500);
      });

      success();

      setStage('3/3 Kitchen load started…');
    } catch (e: any) {
      console.error('Piper native sign-in diagnostic:', e);

      if (e?.message === 'AUTH_TIMEOUT_AFTER_15_SECONDS') {
        setMessage(
          'Firebase sign-in did not answer within 15 seconds.'
        );
      } else {
        const code = e?.code ? `${e.code}: ` : '';
        setMessage(
          `${code}${e?.message || String(e)}`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email) {
      setMessage('Enter your email first.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent.');
    } catch (e: any) {
      setMessage(String(e?.message || e));
    }
  }

  return (
    <div className="modal">
      <div className="modal-card piper-auth">
        <div className="modal-head">
          <div>
            <h2>
              {mode === 'signup'
                ? 'Create your Piper account'
                : 'Sign in to Piper'}
            </h2>

            <p>
              {mode === 'signup'
                ? 'Create your account before continuing setup.'
                : 'Sign in before continuing setup.'}
            </p>
          </div>

          <button onClick={close} aria-label="Close">
            <X />
          </button>
        </div>

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={
            mode === 'signup'
              ? 'new-password'
              : 'current-password'
          }
        />

        {mode === 'signup' && (
          <>
            <label>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </>
        )}

        <button
          className="primary wide"
          disabled={busy || !email || password.length < 6}
          onClick={submit}
        >
          {busy
            ? stage || 'Working…'
            : mode === 'signup'
              ? 'Create account'
              : 'Sign in'}
        </button>

        <button
          className="auth-link"
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setMessage('');
            setStage('');
          }}
        >
          {mode === 'signup'
            ? 'Already have an account? Sign in'
            : 'New to Piper? Create account'}
        </button>

        {mode === 'signin' && (
          <button className="auth-link" onClick={reset}>
            Forgot password
          </button>
        )}

        {message && (
          <p className="auth-message">{message}</p>
        )}
      </div>
    </div>
  );
}
