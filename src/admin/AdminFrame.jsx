import { createElement, useState } from 'react';
import {
  Clapperboard, LayoutDashboard, LogOut, MapPin, Menu, ReceiptText,
  ScanLine, ShieldCheck, Tickets, UsersRound, X,
} from 'lucide-react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from './auth-context';
import './admin.css';

const paths = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'content_manager', 'check_in_staff'], end: true },
  { to: '/admin/movies', label: 'Movies', icon: Clapperboard, roles: ['admin', 'content_manager'] },
  { to: '/admin/venues', label: 'Venues', icon: MapPin, roles: ['admin', 'content_manager'] },
  { to: '/admin/screenings', label: 'Screenings', icon: Tickets, roles: ['admin', 'content_manager'] },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText, roles: ['admin'] },
  { to: '/admin/check-in', label: 'Check-in', icon: ScanLine, roles: ['admin', 'check_in_staff'] },
  { to: '/admin/team', label: 'Team', icon: UsersRound, roles: ['admin'] },
];

export function RequireRole({ roles, children }) {
  const { profile } = useAdminAuth();
  if (!roles.includes(profile?.role)) return <Navigate to="/admin" replace />;
  return children;
}

export default function AdminFrame() {
  const { loading, session, profile, error, signOut } = useAdminAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  if (loading) return <main className="admin-loading">Checking your account…</main>;
  if (!session) return <Navigate to={`/admin/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!['admin', 'content_manager', 'check_in_staff'].includes(profile?.role)) {
    return <main className="admin-access-denied"><ShieldCheck size={32} /><h1>Access restricted</h1>
      <p>{error || 'This account does not have an operational role.'}</p>
      <button className="admin-button" onClick={signOut}>Sign out</button></main>;
  }
  return <div className="admin-app">
    <aside className={`admin-sidebar ${menuOpen ? 'admin-sidebar--open' : ''}`}>
      <Link className="admin-brand" to="/admin" onClick={() => setMenuOpen(false)}>
        <span className="admin-brand-mark"><Clapperboard size={22} /></span>
        <span>Cinema Republic<small>Operations studio</small></span>
      </Link>
      <p className="admin-nav-label">Workspace</p>
      <nav aria-label="Admin navigation">{paths.filter((item) => item.roles.includes(profile.role))
        .map(({ to, label, icon, end }) => <NavLink key={to} to={to} end={end}
          onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'admin-nav-link is-active' : 'admin-nav-link'}>
          {createElement(icon, { size: 18 })} {label}</NavLink>)}</nav>
      <div className="admin-sidebar-bottom"><p>Signed in as<br /><strong>{profile.full_name || session.user.email}</strong></p>
        <span className="admin-role">{profile.role.replaceAll('_', ' ')}</span>
        <button type="button" className="admin-signout" onClick={signOut}><LogOut size={17} /> Sign out</button>
      </div>
    </aside>
    {menuOpen && <button type="button" className="admin-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="admin-main">
      <header className="admin-topbar"><button type="button" className="admin-menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
        <span><ShieldCheck size={17} /> Secure operations</span><Link to="/movies">View public site ↗</Link></header>
      <Outlet />
    </div>
  </div>;
}
