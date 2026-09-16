import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, TicketCheck, TriangleAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatKobo, invokeFunction } from '../lib/catalog';
import '../components/ticketing.css';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function PaymentCallback() {
  const [parameters] = useSearchParams();
  const reference = parameters.get('reference') || '';
  const [state, setState] = useState({ loading: true, status: 'pending', tickets: [], error: '' });

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem(`cinema57:order:${reference}`);
    if (!/^C57-[A-Z0-9]{16,40}$/u.test(reference) || !token) {
      setState({ loading: false, status: 'unknown', tickets: [],
        error: 'We cannot confirm this order in this browser tab. Check your ticket email or contact the cinema with your payment reference.' });
      return undefined;
    }

    async function checkStatus() {
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const result = await invokeFunction('order-status', {
            reference, order_access_token: token,
          });
          if (!active) return;
          setState({ loading: result.status === 'pending', status: result.status,
            tickets: result.tickets || [], amountKobo: result.amount_kobo,
            requiresSupport: result.requires_support, error: '' });
          if (result.status !== 'pending') {
            if (result.status === 'paid') sessionStorage.removeItem(`cinema57:order:${reference}`);
            return;
          }
          await wait(2500);
        }
        if (active) setState((current) => ({ ...current, loading: false,
          error: 'Payment confirmation is taking longer than expected. Do not pay again; check your email or contact support with your reference.' }));
      } catch (error) {
        if (active) setState((current) => ({ ...current, loading: false, error: error.message }));
      }
    }
    checkStatus();
    return () => { active = false; };
  }, [reference]);

  const paid = state.status === 'paid';
  const support = state.status === 'payment_review' || state.requiresSupport;
  return (
    <main className="flow-page">
      <section className="flow-hero ticket-shell">
        <p className="ticket-kicker">Cinema Republic · Secure booking</p>
        <h1>{paid ? 'Your night is booked.' : support ? 'Your payment needs a review.'
          : state.loading ? 'Checking your payment…' : 'Booking update'}</h1>
        <p>{paid ? 'Your digital tickets are ready. We have also sent them to the email address used at checkout.'
          : support ? 'Please contact the cinema with your reference. Do not pay again until we confirm your order.'
          : state.loading ? 'Paystack is finishing your payment while we wait for the secure confirmation.'
          : state.status === 'expired' ? 'This unpaid reservation expired. No tickets were issued.'
          : state.status === 'failed' ? 'Payment did not complete. No tickets were issued.'
          : 'We have not confirmed a paid booking yet.'}</p>
      </section>
      <div className="ticket-shell flow-content">
        <article className="flow-card" aria-live="polite">
          <span className={`flow-icon ${paid ? 'flow-icon--success' : ''}`}>
            {paid ? <CheckCircle2 size={32} /> : state.loading ? <Clock3 size={32} /> : <TriangleAlert size={32} />}
          </span>
          <h2>{paid ? 'Payment confirmed' : state.loading ? 'Awaiting confirmation' : 'Payment not confirmed'}</h2>
          {reference && <p className="flow-reference">Reference: <strong>{reference}</strong></p>}
          {paid && state.amountKobo != null && <p>Paid: {formatKobo(state.amountKobo)}</p>}
          {state.error && <p className="flow-warning" role="alert">{state.error}</p>}
          {paid && <div className="flow-ticket-list">
            {state.tickets.map((ticket, index) => (
              <Link className="flow-ticket-link" key={ticket.public_id} to={`/ticket/${ticket.public_id}`}>
                <TicketCheck size={21} />
                <span><strong>Ticket {index + 1} · {ticket.ticket_type}</strong><small>{ticket.public_id}</small></span>
              </Link>
            ))}
          </div>}
          {!state.loading && <Link className="ticket-button ticket-button--primary" to="/movies">Browse movies</Link>}
        </article>
      </div>
    </main>
  );
}
