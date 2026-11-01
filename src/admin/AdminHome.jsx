import {
  ArrowRight, ArrowUpRight, BadgeDollarSign, CalendarPlus2, CheckCircle2, Clapperboard,
  CreditCard, MapPin, ReceiptText, ScanLine, Tags, Tickets, UserCheck, UsersRound,
} from 'lucide-react';
import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from './auth-context';

const cards = [
  { title: 'Movies', copy: 'Create, publish and archive the programme.', to: '/admin/movies', icon: Clapperboard, roles: ['admin', 'content_manager'] },
  { title: 'Venues', copy: 'Keep locations and arrival details accurate.', to: '/admin/venues', icon: MapPin, roles: ['admin', 'content_manager'] },
  { title: 'Sessions', copy: 'Schedule experiences, sales windows and seating capacity.', to: '/admin/screenings', icon: Tickets, roles: ['admin', 'content_manager'] },
  { title: 'Pricing', copy: 'Schedule weekday and weekend admission prices.', to: '/admin/pricing', icon: BadgeDollarSign, roles: ['admin', 'content_manager'] },
  { title: 'Orders', copy: 'Trace payments, tickets and email delivery.', to: '/admin/orders', icon: ReceiptText, roles: ['admin'] },
  { title: 'Reception', copy: 'Find paid bookings and register arriving guests.', to: '/admin/reception', icon: UserCheck, roles: ['admin', 'cashier', 'supervisor', 'check_in_staff'] },
  { title: 'Admission', copy: 'Verify registered tickets and admit guests.', to: '/admin/check-in', icon: ScanLine, roles: ['admin', 'supervisor', 'check_in_staff'] },
  { title: 'Team', copy: 'Invite operators and assign their access.', to: '/admin/team', icon: UsersRound, roles: ['admin'] },
];

const lifecycle = [
  { title: 'Create experience', copy: 'Add the title, description and approved artwork as a draft.', icon: Clapperboard },
  { title: 'Set pricing', copy: 'Confirm effective weekday and weekend admission prices.', icon: BadgeDollarSign },
  { title: 'Create sessions', copy: 'Choose the venue, dates, times and capacity for each showing.', icon: CalendarPlus2 },
  { title: 'Open sales', copy: 'Publish the experience and place reviewed sessions on sale.', icon: Tickets },
  { title: 'Bookings & payment', copy: 'Customers select a session and Paystack confirms full payment.', icon: CreditCard },
  { title: 'Reception', copy: 'Confirm the booking, register arrival and issue physical tags.', icon: Tags },
  { title: 'Admit & complete', copy: 'Redeem each admission once; the session completes automatically.', icon: CheckCircle2 },
];

export default function AdminHome() {
  const { profile } = useAdminAuth();
  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Operations overview</p>
    <h1>Good to have you here{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h1>
    <p>Choose a workspace to keep the next cinema night running smoothly.</p></div>
    <section className="admin-lifecycle" aria-labelledby="show-lifecycle-title">
      <div className="admin-lifecycle__heading"><div><p className="admin-overline">Show lifecycle</p><h2 id="show-lifecycle-title">From idea to completed session</h2></div>
        <p>Create the experience once, then schedule and operate each bookable session independently.</p></div>
      <div className="admin-lifecycle__steps">{lifecycle.map(({ title, copy, icon }, index) => <div className="admin-lifecycle-step" key={title}>
        <div className="admin-lifecycle-step__top"><span>{createElement(icon, { size: 19 })}</span><small>{String(index + 1).padStart(2, '0')}</small></div>
        <h3>{title}</h3><p>{copy}</p>{index < lifecycle.length - 1 && <ArrowRight className="admin-lifecycle-step__arrow" size={17} aria-hidden="true" />}
      </div>)}</div>
    </section>
    <div className="admin-home-grid">{cards.filter((card) => card.roles.includes(profile.role)).map(({ title, copy, to, icon }) =>
      <Link key={to} to={to} className="admin-home-card"><span>{createElement(icon, { size: 24 })}</span><ArrowUpRight className="admin-home-arrow" size={20} />
        <h2>{title}</h2><p>{copy}</p></Link>)}</div>
    <div className="admin-note"><strong>Before you publish</strong><p>Confirm screening rights, venue details, capacity and pricing. Draft movies do not appear on the public site; only published movies with future on-sale screenings do.</p></div>
  </main>;
}
