import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Mail, ReceiptText, RefreshCw, Search, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatKobo, formatShowing } from '../lib/catalog';
import { adminFunction } from './api';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function search(term = query) {
    setBusy(true); setError('');
    try { const result = await adminFunction('admin-orders', { action: 'search', query: term }); setOrders(result.orders || []); }
    catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    adminFunction('admin-orders', { action: 'search', query: '' })
      .then((result) => { if (active) setOrders(result.orders || []); })
      .catch((caught) => { if (active) setError(caught.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function retryEmail(order) {
    if (!window.confirm(`Retry the ticket email to ${order.customer_email}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await adminFunction('admin-orders', { action: 'retry_email', order_id: order.id });
      setNotice(`Ticket email sent for ${order.reference}.`);
      await search();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Operations / Commerce</p><h1>Orders & payments</h1>
    <p>Find a booking by reference, customer email or public ticket ID.</p></div>
    <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); search(); }}><label className="admin-search"><Search size={18} />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference, email or ticket ID" /></label>
      <button className="admin-button" disabled={busy}><Search size={16} /> Search</button>
      <button type="button" className="admin-button admin-button--quiet" onClick={() => search()} disabled={busy}><RefreshCw size={16} /> Refresh</button></form>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    <div className="admin-panel"><h2>Recent results <span className="admin-count">{orders.length}</span></h2>
      {orders.length === 0 ? <div className="admin-empty"><ReceiptText size={32} /><h3>No orders found</h3><p>Try another reference or email.</p></div> :
        <div className="admin-order-list">{orders.map((order) => <article className="admin-order" key={order.id}>
          <button type="button" className="admin-order-summary" onClick={() => setOpen(open === order.id ? '' : order.id)} aria-expanded={open === order.id}>
            <span><strong>{order.reference}</strong><small>{order.customer_name} · {order.customer_email}</small></span>
            <span className={`admin-status admin-status--${order.status}`}>{order.status.replaceAll('_', ' ')}</span>
            <b>{formatKobo(order.amount_kobo)}</b>{open === order.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {open === order.id && <div className="admin-order-detail"><div className="admin-order-facts">
            <span><small>Booked</small><strong>{formatShowing(order.created_at, 'Africa/Lagos', { dateStyle: 'medium', timeStyle: 'short' })}</strong></span>
            <span><small>Phone</small><strong>{order.customer_phone}</strong></span>
            <span><small>Payment</small><strong>{order.payment?.status || 'Not recorded'}</strong></span>
            <span><small>Email</small><strong>{order.email?.status || 'Not queued'}</strong></span>
          </div>
            {order.payment?.provider_reference && <p className="admin-help">Paystack transaction reference: <strong>{order.payment.provider_reference}</strong></p>}
            {order.refund && <p className="admin-help">Latest Paystack refund event: {order.refund.status} · {formatKobo(order.refund.amount_kobo)}. A partial refund requires manual review.</p>}
            <h3>Purchased items</h3>{order.items?.map((item, index) => <p className="admin-order-item" key={`${item.type}-${index}`}>
              <span>{item.quantity} × {item.type} · {item.movie}<small>{formatShowing(item.showtime, 'Africa/Lagos', { dateStyle: 'medium', timeStyle: 'short' })} · {item.venue}</small></span>
              <strong>{formatKobo(item.unit_price_kobo)}</strong></p>)}
            {order.tickets?.length > 0 && <><h3>Tickets</h3><div className="admin-ticket-links">{order.tickets.map((ticket) =>
              <Link key={ticket.public_id} to={`/ticket/${ticket.public_id}`}><Ticket size={15} /> {ticket.public_id} · {ticket.status}</Link>)}</div></>}
            {order.email?.last_error && <p className="admin-error">Email error: {order.email.last_error}</p>}
            {order.status === 'paid' && order.email?.status !== 'sent' && <button className="admin-button" disabled={busy} onClick={() => retryEmail(order)}><Mail size={16} /> Retry ticket email</button>}
            <p className="admin-help">Refunds are handled in Paystack Dashboard. Do not mark a paid order refunded until the refund is confirmed.</p>
          </div>}
        </article>)}</div>}
    </div>
  </main>;
}
