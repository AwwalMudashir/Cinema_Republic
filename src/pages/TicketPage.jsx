import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin, ShieldCheck, Ticket, TriangleAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatShowing, formatValidityEnd, invokeFunction } from '../lib/catalog';
import '../components/ticketing.css';

export default function TicketPage() {
  const { publicId } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    let active = true;
    invokeFunction('ticket-details', { ticket_id: publicId })
      .then((data) => { if (active) setState({ loading: false, data, error: '' }); })
      .catch((error) => { if (active) setState({ loading: false, data: null, error: error.message }); });
    return () => { active = false; };
  }, [publicId]);

  const { data } = state;
  const zone = data?.screening.venue_timezone || 'Africa/Lagos';
  const canPresent = data?.ticket.status === 'valid';
  const showCode = canPresent || data?.ticket.status === 'not_yet_valid';
  const sessionTitle = data?.session?.title || data?.movie?.title || 'HyperView 9D Flying Cinema Session';
  const isGroup = data?.booking?.booking_type === 'group' || data?.session?.kind === 'group';
  const isFlexible = data?.booking?.access_mode === 'flex_pass' || data?.session?.access_mode === 'flex_pass';
  const durationMinutes = Number(data?.session?.duration_minutes || (isGroup ? 45 : 30));
  const filmCount = Number(data?.session?.film_count || (isGroup ? 3 : 2));
  return (
    <main className="flow-page">
      <section className="flow-hero ticket-shell">
        <p className="ticket-kicker"><Ticket size={16} /> Your digital admission</p>
        <h1>{data ? sessionTitle : 'Your ticket'}</h1>
        <p>Keep this link and its QR code private. Each ticket admits one person, once.</p>
      </section>
      <div className="ticket-shell flow-content">
        {state.loading && <article className="flow-card" role="status">Loading your ticket…</article>}
        {state.error && <article className="flow-card"><TriangleAlert size={32} /><h2>Ticket unavailable</h2><p role="alert">{state.error}</p><Link to="/tickets" className="ticket-button ticket-button--primary">View tickets</Link></article>}
        {data && <article className="digital-ticket">
          <div className="digital-ticket__art digital-ticket__art--session">
            <Ticket size={64} aria-hidden="true" />
            <span>{isFlexible ? 'Flexible admission' : `${durationMinutes}-minute session`}</span>
          </div>
          <div className="digital-ticket__body">
            <p className="ticket-kicker ticket-kicker--dark">Cinema Republic Naija</p>
            <h2>{isFlexible ? 'HyperView flexible admission' : sessionTitle}</h2>
            <p className={`ticket-state ticket-state--${data.ticket.status}`}>
              {canPresent ? 'Ready to present at the gate'
                : data.ticket.status === 'not_yet_valid' ? 'Admission opens soon'
                  : `Ticket ${data.ticket.status.replaceAll('_', ' ')}`}
            </p>
            <div className="digital-ticket__details">
              <p><CalendarDays size={18} /><span>{isFlexible ? `Expires ${formatValidityEnd(data.ticket.valid_until, zone, { dateStyle: 'full', timeStyle: 'short' })}` : formatShowing(data.screening.starts_at, zone, { dateStyle: 'full' })}</span></p>
              <p><Clock3 size={18} /><span>{isFlexible ? 'Any operating session · one use' : `${formatShowing(data.screening.starts_at, zone, { timeStyle: 'short' })} · ${zone}`}</span></p>
              <p><MapPin size={18} /><span>{data.screening.venue}<br />{data.screening.venue_address}, {data.screening.venue_city}</span></p>
              <p><Ticket size={18} /><span>{data.ticket.type}</span></p>
            </div>
            <p className="digital-ticket__experience">{isFlexible ? `Use once at any operating session before expiry. ${isGroup ? 'The 15-person group attends together.' : 'No movie or time was selected online.'}` : `This ${isGroup ? 'exclusive 15-person group ' : ''}session includes ${filmCount} staff-selected 15-minute films.`}</p>
            {showCode && <div className="digital-ticket__qr">
              <img src={data.qr_data_url} alt="QR code containing this ticket URL" />
              <p>Show this code to staff at the entrance.</p>
            </div>}
            <div className="digital-ticket__code"><small>Ticket ID</small><strong>{data.ticket.id}</strong></div>
            <p className="digital-ticket__foot"><ShieldCheck size={17} /> Valid after payment and expires {isFlexible ? formatValidityEnd(data.ticket.valid_until, zone, { dateStyle: 'medium', timeStyle: 'short' }) : formatShowing(data.ticket.valid_until, zone, { dateStyle: 'medium', timeStyle: 'short' })}. It cannot carry into the next validity band.</p>
            {!showCode && <p className="flow-warning">This ticket cannot be redeemed. If you need help, contact the cinema.</p>}
          </div>
        </article>}
      </div>
    </main>
  );
}
