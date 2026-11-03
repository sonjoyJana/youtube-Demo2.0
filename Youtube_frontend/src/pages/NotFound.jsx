import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Brand } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="notfound">
      <Brand size="lg" />
      <span className="notfound-icon">
        <Compass size={36} />
      </span>
      <h1>This page isn't available</h1>
      <p>The link may be broken, or the page may have been removed.</p>
      <Link to={user ? '/' : '/login'} className="btn btn-primary">
        <Home size={17} /> Go to {user ? 'home' : 'sign in'}
      </Link>
    </div>
  );
}
