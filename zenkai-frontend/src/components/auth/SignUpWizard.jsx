import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function SignUpWizard({ onBackToLogin }) {
  const { login } = useAuth();
  const [step, setStep] = useState('name');
  const [preferredName, setPreferredName] = useState('');
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const googleBtnRef = useRef(null);

  // Google button is mounted ONLY on the create step. By then we already have
  // role + preferredName, so the callback can hit /api/auth/google with
  // everything in one shot — backend treats it as phase-2 for new users and
  // ignores role/firstName for returning users.
  useEffect(() => {
    if (step !== 'create') return;
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId || !googleBtnRef.current) return;
    let cancelled = false;
    loadGsi().then(() => {
      if (cancelled || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signup_with',
        width: 296,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleCredential = async (response) => {
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          role,
          firstName: preferredName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Google sign-up failed');
        return;
      }
      login(data.user, data.token);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          role,
          firstName: preferredName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign up failed');
        return;
      }
      login(data.user, data.token);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const advanceFromName = () => {
    if (!preferredName.trim()) return;
    setError('');
    setStep('role');
  };

  const chooseRole = (r) => {
    setRole(r);
    setEmail('');
    setPassword('');
    setError('');
    setStep('create');
  };

  return (
    <div className="lp-card">
      <h1 className="lp-title">Create Your Account</h1>

      {step === 'name' && (
        <>
          <p className="lp-sub">What should we call you?</p>
          <div className="lp-role-select">
            <input
              className="lp-input"
              type="text"
              placeholder="Preferred name"
              value={preferredName}
              onChange={e => setPreferredName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') advanceFromName(); }}
              autoFocus
            />
            {error && <p className="lp-error">{error}</p>}
            <button
              type="button"
              className="lp-role-btn"
              disabled={loading || !preferredName.trim()}
              onClick={advanceFromName}
            >
              Continue
            </button>
          </div>
        </>
      )}

      {step === 'role' && (
        <>
          <p className="lp-sub">Are you working with a coach or training on your own?</p>
          <div className="lp-role-select">
            <button
              type="button"
              className="lp-role-btn"
              disabled={loading}
              onClick={() => chooseRole('client')}
            >
              Working with a coach
            </button>
            <button
              type="button"
              className="lp-role-btn"
              disabled={loading}
              onClick={() => chooseRole('self-serve')}
            >
              Training on my own
            </button>
            {error && <p className="lp-error">{error}</p>}
          </div>
        </>
      )}

      {step === 'create' && (
        <>
          <div style={{ marginBottom: 18 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Preferred Name
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e0e0e0' }}>
                {preferredName}
              </p>
              <button
                type="button"
                onClick={() => setStep('name')}
                style={{ background: 'none', border: 'none', color: '#c8ff00', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Edit
              </button>
            </div>
          </div>

          <form className="lp-form" onSubmit={handleSubmit}>
            <input
              className="lp-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <input
              className="lp-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && <p className="lp-error">{error}</p>}
            <button className="lp-btn" type="submit" disabled={loading || !email || !password}>
              {loading ? 'Loading...' : 'Create Account'}
            </button>
          </form>

          {process.env.REACT_APP_GOOGLE_CLIENT_ID && (
            <>
              <div className="lp-divider"><span>or</span></div>
              <div className="lp-google" ref={googleBtnRef} />
            </>
          )}
        </>
      )}

      {onBackToLogin && (
        <button type="button" className="lp-toggle" onClick={onBackToLogin}>
          Have an account? Sign in
        </button>
      )}
    </div>
  );
}
