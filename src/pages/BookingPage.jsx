import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin, ShieldCheck, Ticket, TriangleAlert, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatKobo, formatShowing, invokeFunction } from '../lib/catalog';
import '../components/ticketing.css';

export default function BookingPage() {
  const { publicId } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    let active = true;
    invokeFunction('booking-details', { booking_id: publicId })
      .then((data) => { if (active) setState({ loading: false, data, error: '' }); })
      .catch((error) => { if (active) setState({ loading: false, data: null, error: error.message }); });
    return () => { active = false; };
  }, [publicId]);

  const { data } = state;
  const zone = data?.screening?.venue_timezone || 'Africa/Lagos';
  const status = data?.status === 'paid' && new Date(data.valid_until).getTime() <= Date.now()
    ? 'expired' : data?.status;
  const presentable = status === 'paid';

  return <main className="flow-page booking-confirmation-page">
    <section className="flow-hero ticket-shell"><p className="ticket-kicker"><Ticket size={16} /> HyperView 9D Flying Cinema</p>
      <h1>{data ? 'Your session is booked.' : 'Your booking'}</h1>
      <p>Present this confirmation at reception and arrive at least 15 minutes before your selected session.</p></section>
    <div className="ticket-shell flow-content">
      {state.loading && <article className="flow-card" role="status">Loading your booking…</article>}
      {state.error && <article className="flow-card"><TriangleAlert size={32} /><h2>Booking unavailable</h2><p role="alert">{state.error}</p><Link to="/movies" className="ticket-button ticket-button--primary">Browse sessions</Link></article>}
      {data && <article className="booking-confirmation">
        <div className="booking-confirmation__art">{data.movie.poster_url && <img src={data.movie.poster_url} alt={`${data.movie.title} poster`} />}
          <div><p className="ticket-kicker">Paid session</p><h2>{data.movie.title}</h2><p>{data.screening.venue}, {data.screening.venue_city}</p></div></div>
        <div className="booking-confirmation__body"><div className="booking-confirmation__heading"><div><small>Booking reference</small><strong>{data.reference}</strong></div>
          <span className={`ticket-state ticket-state--${status}`}>{status === 'paid' ? 'Confirmed' : String(status).replaceAll('_', ' ')}</span></div>
          <div className="booking-confirmation__facts">
            <p><CalendarDays size={19} /><span><small>Date</small><strong>{formatShowing(data.screening.starts_at, zone, { dateStyle: 'full' })}</strong></span></p>
            <p><Clock3 size={19} /><span><small>Session time</small><strong>{formatShowing(data.screening.starts_at, zone, { timeStyle: 'short' })}</strong></span></p>
            <p><Users size={19} /><span><small>Guests</small><strong>{data.quantity}</strong></span></p>
            <p><Ticket size={19} /><span><small>Total paid</small><strong>{formatKobo(data.amount_kobo)}</strong></span></p>
            <p className="booking-confirmation__wide"><MapPin size={19} /><span><small>Venue</small><strong>{data.screening.venue}, {data.screening.venue_address}, {data.screening.venue_city}</strong></span></p>
          </div>
          {presentable && <div className="booking-confirmation__qr"><img src={data.qr_data_url} alt="QR code containing this booking URL" />
            <div><h3>Present at reception</h3><p>Staff will confirm payment, register your party and issue physical identification tags.</p></div></div>}
          <div className="booking-policy-card"><ShieldCheck size={21} /><div><strong>Arrival and validity</strong>
            <p>Arrive at least 15 minutes early. Admission opens {formatShowing(data.valid_from, zone, { dateStyle: 'medium', timeStyle: 'short' })} and this booking expires {formatShowing(data.valid_until, zone, { dateStyle: 'medium', timeStyle: 'short' })}.</p>
            <p>The booking is valid only for this session. It is non-refundable and cannot be rescheduled.</p></div></div>
          {!presentable && <p className="flow-warning">This booking cannot be used for admission. Contact the cinema if you need assistance.</p>}
        </div>
      </article>}
    </div>
  </main>;
}
