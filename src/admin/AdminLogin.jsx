import { useState } from 'react';
import { ArrowRight, Clapperboard, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from './auth-context';
import './admin.css';

export default function AdminLogin() {
  const { loading, session, profile, error: authError, signIn } = useAdminAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invite = params.get('invite') === '1';
  const requested = params.get('next') || '/admin';
  const next = requested.startsWith('/admin/') && !requested.startsWith('//') ? requested : '/admin';
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!loading && session && profile && !invite) return <Navigate to={next} replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      if (invite && session) {
        if (form.password.length < 12) throw new Error('Use at least 12 characters for your password.');
        if (form.password !== form.confirm) throw new Error('Passwords do not match.');
        const { error } = await supabase.auth.updateUser({ password: form.password });
        if (error) throw error;
        navigate('/admin', { replace: true });
      } else {
        await signIn(form.email, form.password);
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <main className="admin-login-page"><div className="admin-login-art">
      <span className="admin-login-brand"><Clapperboard size={26} /> Cinema Republic</span>
      <div><p className="admin-overline">The operations studio</p><h1>Every screening,<br />beautifully in hand.</h1>
        <p>One secure home for the catalogue, bookings, crew and the gate.</p></div>
      <span className="admin-login-foot"><ShieldCheck size={17} /> Access is based on your assigned role.</span>
    </div><div className="admin-login-panel"><form className="admin-login-card" onSubmit={submit}>
      <span className="admin-login-icon"><LockKeyhole size={24} /></span>
      <p className="admin-overline">Staff access</p>
      <h2>{invite && session ? 'Set your password' : 'Welcome back'}</h2>
      <p>{invite && session ? 'Finish activating your invited account.' : 'Sign in with your Cinema Republic staff account.'}</p>
      {(!invite || !session) && <label>Email address<input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>}
      <label>Password<input type="password" minLength={invite && session ? 12 : undefined} autoComplete={invite && session ? 'new-password' : 'current-password'} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {invite && session && <label>Confirm password<input type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></label>}
      {(message || authError) && <p className="admin-error" role="alert">{message || authError}</p>}
      <button className="admin-button admin-button--primary" disabled={busy || loading || !supabase}>{busy ? 'Please wait…' : invite && session ? 'Activate account' : 'Sign in'} <ArrowRight size={17} /></button>
      <small>Access problems? Ask your administrator to check your account and role.</small>
    </form></div></main>;
}
