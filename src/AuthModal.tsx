import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from './firebase';

// Pass 20: friendly sign-in messages. Native sign-in keeps the working Firebase setup in firebase.ts.
const FRIENDLY: Record<string, string> = {
  'auth/invalid-credential': 'That email or password is not right. Check both and try again.',
  'auth/wrong-password': 'That email or password is not right. Check both and try again.',
  'auth/user-not-found': 'That email or password is not right. Check both and try again.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/email-already-in-use': 'An account already exists for this email. Try signing in instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Piper could not reach the internet. Check your connection and try again.',
  'auth/user-disabled': 'This account has been turned off. Contact owner@upswingtx.com for help.',
  'auth/missing-password': 'Enter your password.',
};
const friendly = (e: any) =>
  e?.message === 'AUTH_TIMEOUT'
    ? 'Sign-in is taking too long. Check your connection and try again.'
    : FRIENDLY[e?.code] || 'Something went wrong. Please try again.';

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

  async function submit() {
    if (mode === 'signup' && password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const work =
        mode === 'signup'
          ? createUserWithEmailAndPassword(auth, email.trim(), password)
          : signInWithEmailAndPassword(auth, email.trim(), password);
      // Never leave the button spinning forever if the connection drops.
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 20000)
      );
      await Promise.race([work, timeout]);
      success();
    } catch (e: any) {
      console.warn('Piper sign-in:', e?.code || e);
      setMessage(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) {
      setMessage('Enter your email first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Password reset email sent. Check your inbox.');
    } catch (e: any) {
      setMessage(friendly(e));
    }
  }

  return (
    <div className="modal">
      <div className="modal-card piper-auth">
        <div className="modal-head">
          <div>
            <h2>{mode === 'signup' ? 'Create your Piper account' : 'Sign in to Piper'}</h2>
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
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
        {mode === 'signup' && (
          <>
            <label>Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </>
        )}
        <button className="primary wide" disabled={busy || !email || password.length < 6} onClick={submit}>
          {busy ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
        <button
          className="auth-link"
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setMessage('');
          }}
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New to Piper? Create account'}
        </button>
        {mode === 'signin' && (
          <button className="auth-link" onClick={reset}>
            Forgot password
          </button>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}
      </div>
    </div>
  );
}
