import { ArrowUpRight, Clapperboard, MapPin, ReceiptText, ScanLine, Tickets, UsersRound } from 'lucide-react';
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from './auth-context';

const cards = [
  { title: 'Movies', copy: 'Create, publish and archive the programme.', to: '/admin/movies', icon: Clapperboard, roles: ['admin', 'content_manager'] },
  { title: 'Venues', copy: 'Keep locations and arrival details accurate.', to: '/admin/venues', icon: MapPin, roles: ['admin', 'content_manager'] },
  { title: 'Screenings', copy: 'Set showtimes, sales windows and ticket tiers.', to: '/admin/screenings', icon: Tickets, roles: ['admin', 'content_manager'] },
  { title: 'Orders', copy: 'Trace payments, tickets and email delivery.', to: '/admin/orders', icon: ReceiptText, roles: ['admin'] },
  { title: 'Check-in', copy: 'Verify tickets and redeem at the entrance.', to: '/admin/check-in', icon: ScanLine, roles: ['admin', 'check_in_staff'] },
  { title: 'Team', copy: 'Invite operators and assign their access.', to: '/admin/team', icon: UsersRound, roles: ['admin'] },
];

export default function AdminHome() {
  const { profile } = useAdminAuth();
  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Operations overview</p>
    <h1>Good to have you here{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h1>
    <p>Choose a workspace to keep the next cinema night running smoothly.</p></div>
    <div className="admin-home-grid">{cards.filter((card) => card.roles.includes(profile.role)).map(({ title, copy, to, icon }) =>
      <Link key={to} to={to} className="admin-home-card"><span>{createElement(icon, { size: 24 })}</span><ArrowUpRight className="admin-home-arrow" size={20} />
        <h2>{title}</h2><p>{copy}</p></Link>)}</div>
    <div className="admin-note"><strong>Before you publish</strong><p>Confirm screening rights, venue details, capacity and pricing. Draft movies do not appear on the public site; only published movies with future on-sale screenings do.</p></div>
  </main>;
}
