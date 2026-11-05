import {
  ArrowRight, ArrowUpRight, BadgeDollarSign, CheckCircle2,
  CreditCard, MapPin, ReceiptText, ScanLine, Tags, UserCheck, UsersRound,
} from 'lucide-react';
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from './auth-context';

const cards = [
  { title: 'Venues', copy: 'Keep locations and arrival details accurate.', to: '/admin/venues', icon: MapPin, roles: ['admin', 'content_manager'] },
  { title: 'Pricing', copy: 'Set individual rates and 15-person group totals.', to: '/admin/pricing', icon: BadgeDollarSign, roles: ['admin', 'content_manager'] },
  { title: 'Orders', copy: 'Trace payments, tickets and email delivery.', to: '/admin/orders', icon: ReceiptText, roles: ['admin'] },
  { title: 'Reception', copy: 'Find paid bookings and register arriving guests.', to: '/admin/reception', icon: UserCheck, roles: ['admin', 'cashier', 'supervisor', 'check_in_staff'] },
  { title: 'Admission', copy: 'Verify registered tickets and admit guests.', to: '/admin/check-in', icon: ScanLine, roles: ['admin', 'supervisor', 'check_in_staff'] },
  { title: 'Team', copy: 'Invite operators and assign their access.', to: '/admin/team', icon: UsersRound, roles: ['admin'] },
];

const lifecycle = [
  { title: 'Set pricing', copy: 'Add individual rates and group totals for both day bands.', icon: BadgeDollarSign },
  { title: 'Sell flexible tickets', copy: 'Customers choose individual or group admission without selecting a time.', icon: CreditCard },
  { title: 'Validity window', copy: 'Tickets expire at the end of the current Mon–Thu or Fri–Sun band.', icon: CheckCircle2 },
  { title: 'Reception', copy: 'Confirm the booking, register arrival and issue physical tags.', icon: Tags },
  { title: 'Admit & complete', copy: 'Redeem each admission once; used tickets cannot be presented again.', icon: CheckCircle2 },
];

export default function AdminHome() {
  const { profile } = useAdminAuth();
  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Operations overview</p>
    <h1>Good to have you here{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h1>
    <p>Choose a workspace to keep the next cinema night running smoothly.</p></div>
    <section className="admin-lifecycle" aria-labelledby="show-lifecycle-title">
      <div className="admin-lifecycle__heading"><div><p className="admin-overline">Ticket lifecycle</p><h2 id="show-lifecycle-title">From pricing to one-time admission</h2></div>
        <p>Customers buy one-use admission for any operating session inside the current validity window.</p></div>
      <div className="admin-lifecycle__steps">{lifecycle.map(({ title, copy, icon }, index) => <div className="admin-lifecycle-step" key={title}>
        <div className="admin-lifecycle-step__top"><span>{createElement(icon, { size: 19 })}</span><small>{String(index + 1).padStart(2, '0')}</small></div>
        <h3>{title}</h3><p>{copy}</p>{index < lifecycle.length - 1 && <ArrowRight className="admin-lifecycle-step__arrow" size={17} aria-hidden="true" />}
      </div>)}</div>
    </section>
    <div className="admin-home-grid">{cards.filter((card) => card.roles.includes(profile.role)).map(({ title, copy, to, icon }) =>
      <Link key={to} to={to} className="admin-home-card"><span>{createElement(icon, { size: 24 })}</span><ArrowUpRight className="admin-home-arrow" size={20} />
        <h2>{title}</h2><p>{copy}</p></Link>)}</div>
    <div className="admin-note"><strong>Before selling online</strong><p>Confirm the venue and all four weekday/weekend prices. Customers do not choose movies or time slots; staff coordinate their visit on arrival.</p></div>
  </main>;
}
