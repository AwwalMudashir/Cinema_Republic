import { useEffect, useRef, useState } from 'react';
import {
  Camera, CheckCircle2, LogOut, ScanLine,
  ShieldCheck, TicketCheck, TriangleAlert,
} from 'lucide-react';
import { formatShowing } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from '../admin/auth-context';
import '../components/ticketing.css';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const TICKET_CODE_PATTERN = new RegExp(`(?:^|/)((${UUID}))/?(?:[?#].*)?$`, 'iu');

function parseTicketCode(input) {
  return TICKET_CODE_PATTERN.exec(input.trim())?.[1]?.toLowerCase() || null;
}

async function gateCall(name, ticketId) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: { ticket_id: ticketId },
  });
  if (!error) return data;
  if (error.context instanceof Response) {
    const body = await error.context.json().catch(() => null);
    if (error.context.status === 404 && body?.reason === 'not_found') return body;
    throw new Error(body?.message || error.message);
  }
  throw error;
}

const reasonLabel = {
  not_found: 'No ticket matches that ID.',
  not_yet_valid: 'Admission has not opened for this screening.',
  expired: 'This ticket has expired.',
  already_used: 'This ticket was already checked in.',
  cancelled: 'This ticket or screening was cancelled.',
  refunded: 'This ticket was refunded.',
  order_not_paid: 'The order was not paid.',
  inactive: 'This ticket is not active.',
};

export default function CheckIn() {
  const { signOut } = useAdminAuth();
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cameraState, setCameraState] = useState('');
  const videoRef = useRef(null);
  const cameraRef = useRef({ stream: null, timer: null });

  useEffect(() => () => {
    if (cameraRef.current.timer) clearInterval(cameraRef.current.timer);
    cameraRef.current.stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopCamera = () => {
    if (cameraRef.current.timer) clearInterval(cameraRef.current.timer);
    cameraRef.current.stream?.getTracks().forEach((track) => track.stop());
    cameraRef.current = { stream: null, timer: null };
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('');
  };

  const verify = async (input) => {
    const id = parseTicketCode(input);
    if (!id) {
      setCameraState('Enter a ticket UUID or paste the full ticket link.');
      return;
    }
    setBusy(true);
    setResult(null);
    setCode(id);
    try {
      setResult(await gateCall('verify-ticket', id));
      stopCamera();
    } catch (error) {
      setResult({ valid: false, reason: 'error', message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    const id = parseTicketCode(code);
    if (!result?.valid || !id) return;
    setBusy(true);
    try {
      setResult(await gateCall('redeem-ticket', id));
    } catch (error) {
      setResult({ valid: false, reason: 'error', message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    if (!('BarcodeDetector' in window)) {
      setCameraState('Camera QR scanning is unavailable in this browser. Paste the ticket link or type the ID below.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('Camera access requires HTTPS. Paste the ticket link or type the ID below.');
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: 'environment' },
      });
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      cameraRef.current.stream = stream;
      setCameraState('Point the camera at the ticket QR code.');
      let scanning = false;
      cameraRef.current.timer = setInterval(async () => {
        if (scanning || !videoRef.current || videoRef.current.readyState < 2) return;
        scanning = true;
        try {
          const detections = await detector.detect(videoRef.current);
          const id = detections.map((item) => parseTicketCode(item.rawValue)).find(Boolean);
          if (id) {
            stopCamera();
            verify(id);
          }
        } catch {
          // An occasional unreadable frame is normal; keep the scanner open.
        } finally {
          scanning = false;
        }
      }, 300);
    } catch (error) {
      stopCamera();
      setCameraState(`Camera could not start: ${error.message}. Enter the ticket ID manually.`);
    }
  };

  const leaveDesk = async () => {
    stopCamera();
    setResult(null);
    setCode('');
    await signOut();
  };

  const ticket = result?.ticket;
  const movie = result?.movie;
  const screening = result?.screening;
  const zone = screening?.venue_timezone || 'Africa/Lagos';
  return (
    <main className="flow-page gate-page">
      <section className="flow-hero ticket-shell">
        <p className="ticket-kicker"><ShieldCheck size={17} /> Staff-only gate desk</p>
        <h1>Welcome guests.<br />Protect every seat.</h1>
        <p>Scan to inspect a ticket, then redeem it only when admitting the guest.</p>
      </section>
      <div className="ticket-shell flow-content">
        <div className="gate-grid">
          <section className="flow-card gate-scanner">
            <div className="gate-card-heading"><span className="flow-icon"><ScanLine size={30} /></span>
              <button className="gate-sign-out" type="button" onClick={leaveDesk}><LogOut size={16} /> Sign out</button></div>
            <h2>Scan a ticket</h2>
            <p>Paste the link in the ticket email, enter its UUID, or use the camera on a supported browser.</p>
            <video className={cameraRef.current.stream ? 'gate-video gate-video--active' : 'gate-video'}
              ref={videoRef} playsInline muted aria-label="Ticket scanning camera" />
            <div className="gate-camera-actions">
              <button type="button" className="ticket-button ticket-button--primary" onClick={cameraRef.current.stream ? stopCamera : startCamera}>
                <Camera size={18} /> {cameraRef.current.stream ? 'Stop camera' : 'Open camera'}
              </button>
            </div>
            {cameraState && <p className="gate-hint" role="status">{cameraState}</p>}
            <form onSubmit={(event) => { event.preventDefault(); verify(code); }}>
              <label>Ticket link or ID<input value={code} onChange={(event) => { setCode(event.target.value); setResult(null); }}
                placeholder="Paste https://…/ticket/… or UUID" autoComplete="off" /></label>
              <button className="gate-verify-button" type="submit" disabled={busy || !code.trim()}>
                <ScanLine size={18} /> {busy ? 'Checking…' : 'Verify ticket'}
              </button>
            </form>
          </section>
          <section className="flow-card gate-result" aria-live="polite">
            {!result && <div className="gate-empty"><TicketCheck size={40} /><h2>Ready for the next guest</h2><p>A verified admission will appear here with its film, venue and status.</p></div>}
            {result && <>
              <span className={`flow-icon ${result.valid ? 'flow-icon--success' : ''}`}>
                {result.valid ? <CheckCircle2 size={31} /> : <TriangleAlert size={31} />}
              </span>
              <h2>{result.redeemed ? 'Guest admitted' : result.valid ? 'Ticket is valid' : 'Do not admit'}</h2>
              <p className={result.valid ? 'gate-success' : 'flow-warning'}>
                {result.redeemed ? 'This ticket has been redeemed and cannot be used again.'
                  : result.valid ? 'Check the guest and admit only after tapping Redeem.'
                  : result.message || reasonLabel[result.reason] || 'This ticket is not valid.'}
              </p>
              {movie && <div className="gate-ticket-details">
                {movie.poster_url && <img src={movie.poster_url} alt="" />}
                <div><h3>{movie.title}</h3><p>{ticket?.type} · {movie.rating}</p></div>
              </div>}
              {ticket && <p className="gate-detail"><strong>Holder</strong><span>{ticket.holder_name}</span></p>}
              {screening && <>
                <p className="gate-detail"><strong>Showing</strong><span>{formatShowing(screening.starts_at, zone, { dateStyle: 'medium', timeStyle: 'short' })}</span></p>
                <p className="gate-detail"><strong>Venue</strong><span>{screening.venue}, {screening.venue_city}</span></p>
              </>}
              {ticket?.checked_in_at && <p className="gate-detail"><strong>Checked in</strong><span>{formatShowing(ticket.checked_in_at, zone, { dateStyle: 'medium', timeStyle: 'short' })}</span></p>}
              {ticket && <p className="gate-code">{ticket.id}</p>}
              {result.valid && !result.redeemed && <button className="gate-redeem-button" type="button" onClick={redeem} disabled={busy}>
                <TicketCheck size={20} /> {busy ? 'Redeeming…' : 'Redeem & admit guest'}
              </button>}
            </>}
          </section>
        </div>
      </div>
    </main>
  );
}
