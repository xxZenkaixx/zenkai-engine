import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

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

export default function LoginPage({ variant = 'member' }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [signupRole, setSignupRole] = useState(null);
  const [nameStepRole, setNameStepRole] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = variant === 'admin';
  const googleBtnRef = useRef(null);

  // Holds the verified Google ID token between phase 1 (we discovered the
  // email is new and need a role) and phase 2 (user picked a role, send the
  // SAME credential back so the backend can re-verify and create the account).
  // null means we are NOT mid-Google-signup; the existing flows are unchanged.
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState(null);

  const handleGoogleCredential = async (response) => {
    setError(null);
    setLoading(true);
    try {
      // Phase 1: send the Google credential alone. Backend either logs an
      // existing user in (returns { token, user }) or tells us this email is
      // new and we need to collect a role (returns { needs_role: true }).
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Google sign-in failed');
        return;
      }
      // New Google user — switch the UI into the existing signup role picker
      // and stash the credential. The next click will be on a role button,
      // which calls completeGoogleSignup() with the SAME credential plus role.
      if (data.needs_role) {
        if (isAdmin) {
          // Admin accounts cannot self-register, by Google or otherwise.
          setError('Admin accounts cannot be created via Google sign-in.');
          return;
        }
        setPendingGoogleCredential(response.credential);
        setMode('signup');
        setSignupRole(null);
        return;
      }
      // Existing user logged in — same role gates as the email/password path.
      if (isAdmin && data.user.role !== 'admin') {
        setError('This login is for admins only. Please use the member login.');
        return;
      }
      if (!isAdmin && data.user.role === 'admin') {
        setError('Admin accounts must log in at /admin.');
        return;
      }
      login(data.user, data.token);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 of Google signup: user has picked a role on the existing
  // role-select screen. Resend the stashed credential plus the chosen role;
  // backend re-verifies the credential and creates the User + Client rows.
  const completeGoogleSignup = async (role, firstName) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: pendingGoogleCredential, role, firstName })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Google sign-up failed');
        return;
      }
      // Account is now created and a JWT minted — clear the pending state
      // before flipping into the logged-in app shell.
      setPendingGoogleCredential(null);
      login(data.user, data.token);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId || !googleBtnRef.current) return;
    let cancelled = false;
    loadGsi().then(() => {
      if (cancelled || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: mode === 'signup' ? 'signup_with' : 'signin_with',
        width: 296
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = mode === 'signup'
        ? { email, password, role: signupRole, firstName }
        : { email, password };
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      if (isAdmin && data.user.role !== 'admin') {
        setError('This login is for admins only. Please use the member login.');
        return;
      }
      if (!isAdmin && data.user.role === 'admin') {
        setError('Admin accounts must log in at /admin.');
        return;
      }
      login(data.user, data.token);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleModeToggle = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setSignupRole(null);
    setNameStepRole(null);
    setFirstName('');
    // Toggling away from the role picker means the user is backing out of
    // the Google signup they started — drop the stashed credential so the
    // Google button reappears and the next attempt starts a fresh phase 1.
    setPendingGoogleCredential(null);
    setError(null);
  };

  return (
    <div className="lp-wrap">
      <div className="lp-card">
        <h1 className="lp-title">{isAdmin ? 'Admin Login' : 'Member Login'}</h1>
        <p className={`lp-sub${isAdmin ? ' lp-sub--admin' : ''}`}>
          {isAdmin
            ? 'Admin access only'
            : mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </p>

        {!isAdmin && mode === 'signup' && !nameStepRole && !signupRole && (
          <div className="lp-role-select">
            <p className="lp-role-prompt">Are you working with a coach or training on your own?</p>
            <button
              className="lp-role-btn"
              disabled={loading}
              onClick={() => setNameStepRole('client')}
            >
              Working with a coach
            </button>
            <button
              className="lp-role-btn"
              disabled={loading}
              onClick={() => setNameStepRole('self-serve')}
            >
              Training on my own
            </button>
            {error && <p className="lp-error">{error}</p>}
          </div>
        )}

        {!isAdmin && mode === 'signup' && nameStepRole && !signupRole && (
          <div className="lp-role-select">
            <p className="lp-role-prompt">What's your first name?</p>
            <input
              className="lp-input"
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              autoFocus
            />
            {error && <p className="lp-error">{error}</p>}
            <button
              className="lp-role-btn"
              disabled={loading || !firstName.trim()}
              onClick={() => {
                if (pendingGoogleCredential) {
                  completeGoogleSignup(nameStepRole, firstName.trim());
                } else {
                  setSignupRole(nameStepRole);
                  setNameStepRole(null);
                }
              }}
            >
              {loading ? 'Loading...' : 'Continue'}
            </button>
          </div>
        )}

        {(mode === 'login' || signupRole) && (
          <>
            <form className="lp-form" onSubmit={handleSubmit}>
              <input
                className="lp-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
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
              <button className="lp-btn" type="submit" disabled={loading}>
                {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
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

        {!isAdmin && (
          <button className="lp-toggle" onClick={handleModeToggle}>
            {mode === 'login' ? 'No account? Sign up' : 'Have an account? Sign in'}
          </button>
        )}
      </div>
    </div>
  );
}
