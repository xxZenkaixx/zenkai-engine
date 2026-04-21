import { useAuth } from '../contexts/AuthContext';
import LoginPage from './LoginPage';

export default function PrivateRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <LoginPage />;
  return children;
}
