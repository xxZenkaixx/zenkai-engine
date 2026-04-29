import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export default function LoginPage({ variant = 'member' }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [signupRole, setSignupRole] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = variant === 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = mode === 'signup'
        ? { email, password, role: signupRole }
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

        {!isAdmin && mode === 'signup' && !signupRole && (
          <div className="lp-role-select">
            <p className="lp-role-prompt">Are you working with a coach or training on your own?</p>
            <button className="lp-role-btn" onClick={() => setSignupRole('client')}>
              Working with a coach
            </button>
            <button className="lp-role-btn" onClick={() => setSignupRole('self-serve')}>
              Training on my own
            </button>
          </div>
        )}

        {(mode === 'login' || signupRole) && (
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
