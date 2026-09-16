import { useEffect, useState } from 'react';
import { MailPlus, ShieldCheck, UsersRound } from 'lucide-react';
import { useAdminAuth } from './auth-context';
import { adminFunction } from './api';

const roleNames = { admin: 'Admin', content_manager: 'Content manager', check_in_staff: 'Check-in staff', customer: 'Customer / no staff access' };

export default function AdminTeam() {
  const { session } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'check_in_staff' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function refresh() {
    const result = await adminFunction('admin-team', { action: 'list' });
    setUsers(result.users || []);
  }
  useEffect(() => {
    let active = true;
    adminFunction('admin-team', { action: 'list' })
      .then((result) => { if (active) setUsers(result.users || []); })
      .catch((caught) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, []);
  async function sendInvite(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await adminFunction('admin-team', { action: 'invite', ...invite });
      setNotice(`Invitation sent to ${invite.email}. Their ${roleNames[invite.role]} role is assigned.`);
      setInvite({ email: '', full_name: '', role: 'check_in_staff' });
      await refresh();
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  async function changeRole(user, role) {
    if (role === user.role) return;
    if (!window.confirm(`Change ${user.email} from ${roleNames[user.role]} to ${roleNames[role]}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await adminFunction('admin-team', { action: 'set_role', user_id: user.id, role });
      await refresh(); setNotice(`${user.email} is now ${roleNames[role]}.`);
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  return <main className="admin-content"><div className="admin-page-header"><p className="admin-overline">Operations / Access</p><h1>Team & permissions</h1>
    <p>Invite staff and give each person only the access they need.</p></div>
    <div className="admin-two-column"><section className="admin-panel"><h2>Accounts <span className="admin-count">{users.length}</span></h2>
      {users.length === 0 ? <div className="admin-empty"><UsersRound size={32} /><p>No operational accounts found.</p></div> :
        <div className="admin-team-list">{users.map((user) => <div className="admin-team-row" key={user.id}>
          <span className="admin-avatar">{(user.full_name || user.email || '?').slice(0, 1).toUpperCase()}</span>
          <span className="admin-team-name"><strong>{user.full_name || user.email}</strong><small>{user.email}</small></span>
          <select aria-label={`Role for ${user.email}`} value={user.role} disabled={busy || user.id === session?.user.id}
            onChange={(e) => changeRole(user, e.target.value)}>{Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>)}</div>}
      <p className="admin-help">Your own role cannot be changed here. Changes are checked server-side and recorded in the role audit log.</p>
    </section><form className="admin-panel" onSubmit={sendInvite}><span className="admin-panel-icon"><MailPlus size={22} /></span><h2>Invite a teammate</h2>
      <p>They receive a Supabase Auth invitation to set their password. They will use the same staff login as you.</p>
      <div className="admin-fields admin-fields--single"><label>Full name<input maxLength={120} value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} /></label>
        <label>Email<input required type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label>
        <label>Role<select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
          <option value="check_in_staff">Check-in staff · gate only</option><option value="content_manager">Content manager · catalogue</option><option value="admin">Admin · full operations</option>
        </select></label></div>
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
      <button className="admin-button admin-button--primary" disabled={busy}><MailPlus size={17} /> {busy ? 'Working…' : 'Send invitation'}</button>
      <p className="admin-help"><ShieldCheck size={14} /> Auth invitation delivery must be configured in Supabase. Resend ticket emails are a separate service.</p>
    </form></div>
  </main>;
}
