import {
  ArrowRight, ArrowUpRight, BadgeDollarSign,
  CreditCard, MapPin, ReceiptText, ScanLine, UserCheck, UsersRound,
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
  { title: 'Prepare the offer', copy: 'Keep the venue active and set individual and group prices for both day bands.', icon: BadgeDollarSign },
  { title: 'Customer pays online', copy: 'Paystack confirms a one-use flexible ticket and its Thursday or Sunday expiry.', icon: CreditCard },
  { title: 'Reception registers', copy: 'Find the paid booking, register the party and issue physical identification tags.', icon: UserCheck },
  { title: 'Verify and admit', copy: 'Check validity at the gate, then redeem each admission once as the guest enters.', icon: ScanLine },
];

export default function AdminHome() {
  const { profile } = useAdminAuth();
  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Operations overview</p>
    <h1>Good to have you here{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h1>
    <p>Choose a workspace to keep the next cinema night running smoothly.</p></div>
    <section className="admin-lifecycle" aria-labelledby="ticket-lifecycle-title">
      <div className="admin-lifecycle__heading"><div><p className="admin-overline">Ticket lifecycle</p><h2 id="ticket-lifecycle-title">From pricing to one-time admission</h2></div>
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
