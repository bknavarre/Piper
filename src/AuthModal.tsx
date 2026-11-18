import React,{useState}from'react';
import{X}from'lucide-react';
import{createUserWithEmailAndPassword,sendPasswordResetEmail,signInWithEmailAndPassword}from'firebase/auth';
import{auth}from'./firebase';
export default function AuthModal({close,success,initialMode='signin'}:{close:()=>void;success:()=>void;initialMode?:'signin'|'signup'}){const[mode,setMode]=useState<'signin'|'signup'>(initialMode),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);async function submit(){if(mode==='signup'&&password!==confirm)return setMessage('Passwords do not match.');setBusy(true);setMessage('');try {
  setMessage('1/3 Contacting Firebase…');

  if (mode === 'signup') {
    await createUserWithEmailAndPassword(auth, email, password);
  } else {
    await signInWithEmailAndPassword(auth, email, password);
  }

  setMessage('2/3 Signed in. Loading your Piper kitchen…');

  // Let React actually paint the diagnostic before kitchen loading starts.
  await new Promise(resolve => setTimeout(resolve, 250));

  success();

  setMessage('3/3 Kitchen load started.');
} catch (e: any) {
  console.error('Piper sign-in diagnostic:', e);
  setMessage(
    `Sign-in error: ${e?.code || ''} ${e?.message || String(e)}`
  );
} finally {
  setBusy(false);
}}async function reset(){if(!email)return setMessage('Enter your email first.');try{await sendPasswordResetEmail(auth,email);setMessage('Password reset email sent.')}catch(e:any){setMessage(String(e.message||e))}}return <div className="modal"><div className="modal-card piper-auth"><div className="modal-head"><div><h2>{mode==='signup'?'Create your Piper account':'Sign in to Piper'}</h2><p>{mode==='signup'?'Create your account before continuing setup.':'Sign in before continuing setup.'}</p></div><button onClick={close}><X/></button></div><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signup'?'new-password':'current-password'}/>{mode==='signup'&&<><label>Confirm password</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></>}<button className="primary wide" disabled={busy||!email||password.length<6} onClick={submit}>{busy?'Working…':mode==='signup'?'Create account':'Sign in'}</button><button className="auth-link" onClick={()=>setMode(mode==='signup'?'signin':'signup')}>{mode==='signup'?'Already have an account? Sign in':'New to Piper? Create account'}</button>{mode==='signin'&&<button className="auth-link" onClick={reset}>Forgot password</button>}{message&&<p className="auth-message">{message}</p>}</div></div>}
