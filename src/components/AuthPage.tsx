import { FormEvent, useEffect, useState } from 'react';
import { Droplets, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { stationLogo } from '@/lib/logo';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'register';

const readMode = (): Mode => (window.location.hash === '#/register' ? 'register' : 'login');

export function AuthLoading() {
  return (
    <div className="auth-loading">
      <div className="auth-logo-frame"><img src={stationLogo} alt="CRMA Water Refilling Station" /></div>
      <p>Opening your station...</p>
    </div>
  );
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>(readMode);
  const [fullName, setFullName] = useState('');
  const [stationName, setStationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (window.location.hash !== '#/login' && window.location.hash !== '#/register') {
      window.history.replaceState(null, '', '#/login');
    }
    const syncMode = () => setMode(readMode());
    window.addEventListener('hashchange', syncMode);
    return () => window.removeEventListener('hashchange', syncMode);
  }, []);

  const openMode = (next: Mode) => {
    window.location.hash = next === 'register' ? '/register' : '/login';
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (!fullName.trim() || !stationName.trim()) {
        setError('Enter the owner name and station name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Those passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              station_name: stationName.trim(),
              role: 'owner',
            },
          },
        });
        if (signUpError) {
          setError(friendlyAuthError(signUpError.message));
          return;
        }
        if (data.user && data.user.identities?.length === 0) {
          setError('That email already has an owner account. Sign in instead.');
          return;
        }
        if (data.session && data.user) {
          await supabase.from('station_owners').upsert({
            id: data.user.id,
            full_name: fullName.trim(),
            station_name: stationName.trim(),
            email: cleanEmail,
          });
        }
        if (!data.session) {
          openMode('login');
          setEmail(cleanEmail);
          setNotice('Account created. Confirm the email we sent, then sign in.');
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError) setError(friendlyAuthError(signInError.message));
    } finally {
      setSubmitting(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <div className="auth-logo-frame"><img src={stationLogo} alt="CRMA Water Refilling Station" /></div>
        <p className="auth-hero-note">Sign in to run sales, inventory, customers, and expenses. <strong>Pure water. Better life.</strong></p>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">{isRegister ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</p>
          <h2>{isRegister ? 'Register as station owner' : 'Sign in to your station'}</h2>
          <p className="muted">{isRegister ? 'Use the email and password you will use every day at the station.' : 'Only a registered water station owner can open this workspace.'}</p>

          {error && <div className="auth-alert" role="alert">{error}</div>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}

          {isRegister && (
            <>
              <label htmlFor="owner-name">Owner name
                <span className="auth-input">
                  <UserRound size={16} />
                  <input id="owner-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Juan Dela Cruz" autoComplete="name" />
                </span>
              </label>
              <label htmlFor="station-name">Station name
                <span className="auth-input">
                  <Droplets size={16} />
                  <input id="station-name" value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="CRMA Water Refilling Station" autoComplete="organization" />
                </span>
              </label>
            </>
          )}

          <label htmlFor="owner-email">Email
            <span className="auth-input">
              <Mail size={16} />
              <input id="owner-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@station.com" autoComplete="email" />
            </span>
          </label>

          <label htmlFor="owner-password">Password
            <span className="auth-input">
              <Lock size={16} />
              <input id="owner-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={isRegister ? 'new-password' : 'current-password'} />
              <button type="button" className="auth-eye" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {isRegister && (
            <label htmlFor="owner-confirm">Confirm password
              <span className="auth-input">
                <Lock size={16} />
                <input id="owner-confirm" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" autoComplete="new-password" />
              </span>
            </label>
          )}

          <button className="primary-button full" type="submit" disabled={submitting}>
            {submitting ? 'Please wait...' : isRegister ? 'Create owner account' : 'Sign in'}
          </button>

          {isRegister ? (
            <p className="auth-switch">Already registered? <button type="button" onClick={() => openMode('login')}>Sign in</button></p>
          ) : (
            <p className="auth-switch">New station owner? <button type="button" onClick={() => openMode('register')}>Create an account</button></p>
          )}
        </form>
      </section>
    </div>
  );
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'That email or password is incorrect.';
  if (normalized.includes('email not confirmed')) return 'Confirm your email first, then sign in.';
  if (normalized.includes('already registered') || normalized.includes('already been registered')) return 'That email already has an owner account. Sign in instead.';
  if (normalized.includes('password')) return 'Use a password with at least 6 characters.';
  return message;
}
