# HyperView Online Booking Reactivation and Operations Guide

Last updated: 19 October 2026

## 1. Current decision and release state

Cinema Republic has approved restarting development of online booking for **HyperView 9D Flying Cinema**. The upgraded implementation is session-based: the customer purchases places for one experience, date and time, rather than buying a reusable general-entry ticket.

The implementation is present, but both switches remain `false` by default so it cannot become public before the staging migration, Edge Function deployment and acceptance tests are complete:

```js
export const PUBLIC_TICKETING_ENABLED = false;
export const TICKETING_ADMIN_ENABLED = false;
```

Enable the admin switch on staging first. Enable the public switch only after pricing, sessions, Paystack test payments, email, reception and admission have all passed.

## 1.1 Approved HyperView business rules

- Every booking is tied to one specific experience, date and session time.
- Full payment is collected online through Paystack; there is no outstanding balance at reception.
- Monday–Friday admission is **₦10,500 per person**.
- Saturday–Sunday admission is **₦12,500 per person**.
- Prices are effective-dated database rules and can be changed for November 2026 without a frontend deployment.
- One **General admission** inventory is used per session. Its capacity is the number of people who can buy that session.
- A pending Paystack checkout holds capacity for approximately ten minutes. This is not the customer's ticket expiry.
- Admission opens 15 minutes before the selected session by default.
- The booking expires after the selected session ends plus the configured operational grace period, 30 minutes by default.
- A missed session cannot be used for a later session.
- The customer must accept the non-refundable, no-rescheduling and arrival policy before Paystack opens.
- The confirmation email contains one booking reference and booking QR for the party. Individual admissions remain in the database beneath that booking.
- Reception registration and final admission are separate staff actions.

Internal screening states map to operations as follows:

| Database status | Staff meaning |
| --- | --- |
| `draft` | Not available to customers |
| `on_sale` | Scheduled and accepting bookings |
| `sold_out` | Full; set automatically |
| `in_progress` | Session has started; set automatically |
| `completed` | Session has ended; set automatically |
| `cancelled` | Deliberately cancelled by authorised staff |

## 2. What is currently disabled

### Public customer experience

When `PUBLIC_TICKETING_ENABLED` is `false`:

- The **Book HyperView** navigation link is removed on desktop and mobile.
- The desktop and mobile **Book a session** buttons are removed.
- The home-page **Book HyperView 9D** CTA is removed.
- The home page no longer loads the upcoming-movies/screenings preview.
- The ticketing banner and **Movies & tickets** footer links are removed.
- `/movies` and every `/movies/:slug` booking URL redirect to `/`.
- `/payment/callback` redirects to `/`.
- `/ticket/:publicId` and `/booking/:publicId` redirect to `/`.
- The public movie catalogue, checkout form and Supabase catalogue query are not loaded during a normal site visit.

General company language such as **host a screening**, past event screenings and contact enquiries remains visible. Those describe Cinema Republic's existing event services and do not start an online payment.

### Admin and staff experience

When `TICKETING_ADMIN_ENABLED` is `false`, every `/admin/...` URL redirects to `/`. The following code is preserved but unavailable through the deployed website:

- Admin authentication and role-based access control.
- Experience, venue, session, effective pricing and capacity management.
- Bulk daily session creation across a date range.
- Order and email-retry tools.
- Reception booking search and arrival registration.
- Team invitation and role management.
- Supervisor ticket verification and one-time admission.

### Backend retained for later

The Supabase schema, migrations, Row Level Security policies, Storage setup, Edge Functions, Paystack integration, Resend integration, cron jobs and existing staging data have not been removed by this frontend pause.

The main backend reference remains `SUPABASE_BACKEND_GUIDE.md`.

Important: hiding the customer UI stops ordinary visitors from starting checkout through the website, but it does not undeploy an already deployed Edge Function. Until launch:

- Keep Paystack in **test mode**; do not install a live secret key.
- Do not advertise or distribute the `initialize-payment` Function URL.
- Keep production ticketing data and staff access unused.
- If the business requires a server-level shutdown, remove/rotate the Paystack secret or add a server-side `PAYMENTS_ENABLED` guard and redeploy `initialize-payment`. Do not do this casually on staging if it is still needed for future testing.

## 3. Files controlling the paused UI

| Concern | File |
| --- | --- |
| Master frontend switches | `src/config/features.js` |
| Customer/admin route activation and redirects | `src/Display.jsx` |
| Admin layout suppression | `src/App.jsx` |
| Desktop/mobile Movies links and ticket buttons | `src/components/Navbar.jsx` |
| Home hero purchase CTA | `src/components/HeroSection.jsx` |
| Upcoming movie preview | `src/pages/Home.jsx` |
| Ticketing footer banner and Movies link | `src/components/Footer.jsx` |

Do not delete the disabled pages, components or styles. In particular, preserve:

- `src/pages/Movies.jsx`
- `src/pages/MovieBooking.jsx`
- `src/pages/PaymentCallback.jsx`
- `src/pages/TicketPage.jsx`
- `src/pages/BookingPage.jsx`
- `src/pages/CheckIn.jsx`
- `src/components/MovieCard.jsx`
- `src/components/MovieSneakPeek.jsx`
- `src/components/ticketing.css`
- `src/hooks/useMovieProgramme.js`
- `src/lib/catalog.js`
- `src/admin/`
- `supabase/`

Important additions for the HyperView workflow are:

- `src/admin/AdminPricing.jsx` — effective weekday/weekend pricing.
- `src/admin/AdminReception.jsx` — paid-booking lookup and arrival registration.
- `supabase/functions/booking-details/` — safe public group-booking display.
- `supabase/functions/staff-bookings/` — authenticated reception operations.
- `supabase/migrations/20261019090000_hyperview_enum_values.sql` — new staff/session statuses.
- `supabase/migrations/20261019091000_hyperview_session_booking.sql` — pricing, validity, operations and automation.

## 4. Safe reactivation sequence

Do **not** enable public checkout directly in production. Reactivate it in staging first.

### Phase A — confirm business and account readiness

1. Get written approval to restart online ticketing.
2. Confirm the ticket prices, refund/cancellation rules, admission-opening time, venue timezone and customer-support contact.
3. Confirm who will hold these roles:
   - `admin`
   - `content_manager`
   - `cashier`
   - `supervisor`
4. Confirm Cinema Republic's Paystack account is fully verified and ready for live collections.
5. Confirm the Resend sending domain and `EMAIL_FROM` address remain verified.

### Phase B — restore and verify the staging backend

1. Link the CLI to the **staging** Supabase project and verify the reference before pushing anything:

   ```powershell
   npx.cmd supabase projects list
   npx.cmd supabase link --project-ref STAGING_PROJECT_REF
   npx.cmd supabase db push --dry-run
   npx.cmd supabase db push
   ```

2. Confirm all required migrations are present and applied.
3. Confirm the staging Edge Function secrets:
   - `PAYSTACK_SECRET_KEY` — test key only
   - `TICKET_HASH_SECRET`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `SITE_URL=https://staging.cinemarepublicnaija.com`
   - `ALLOWED_ORIGINS=https://staging.cinemarepublicnaija.com`
4. Deploy or redeploy the payment and ticket Functions:

   ```powershell
   npx.cmd supabase functions deploy initialize-payment
   npx.cmd supabase functions deploy paystack-webhook
   npx.cmd supabase functions deploy order-status
   npx.cmd supabase functions deploy verify-ticket
   npx.cmd supabase functions deploy redeem-ticket
   npx.cmd supabase functions deploy ticket-details
   npx.cmd supabase functions deploy booking-details
   npx.cmd supabase functions deploy staff-bookings
   npx.cmd supabase functions deploy admin-team
   npx.cmd supabase functions deploy admin-orders
   ```

5. Confirm the Paystack **test-mode** webhook points to:

   ```text
   https://STAGING_PROJECT_REF.supabase.co/functions/v1/paystack-webhook
   ```

6. Confirm the pending-order job is active. Also confirm a job named `sync-hyperview-sessions` runs every minute with `select public.sync_hyperview_operations();`. The migration creates it automatically when Cron is already enabled; otherwise add it in Dashboard after enabling Cron.
7. Add one complete test programme: published HyperView experience, poster, active venue, effective pricing rule, future scheduled session and General Admission capacity.
8. Confirm staging admin/staff accounts and role assignments.

### Phase C — enable the admin workspace on staging

In `src/config/features.js`, change only:

```js
export const TICKETING_ADMIN_ENABLED = true;
```

Keep `PUBLIC_TICKETING_ENABLED` false. Deploy to staging and verify:

- `/admin/login`
- Role-based navigation for admin, content manager, cashier and supervisor.
- Experience/venue/session/capacity CRUD.
- Weekday/weekend pricing rules and a future effective rule.
- Bulk session creation.
- Poster uploads.
- Order listing and email retry.
- Reception booking retrieval and arrival registration.
- Supervisor verification and one-time admission.

This order allows staff to prepare catalogue data without exposing checkout to customers.

### Phase D — enable public ticketing on staging

After the admin tests pass, change:

```js
export const PUBLIC_TICKETING_ENABLED = true;
```

Deploy to staging and confirm that Movies, ticket buttons, footer promotion and the home preview return automatically.

Run the complete customer test matrix:

1. Browse published experiences and future scheduled sessions.
2. Verify coming-soon, sold-out and available states.
3. Confirm Monday–Friday sessions show ₦10,500 and Saturday–Sunday sessions show ₦12,500.
4. Select a General Admission quantity and confirm the database recalculates the total in naira/kobo.
5. Complete a Paystack test payment.
6. Return to `/payment/callback` on the same staging hostname.
7. Confirm webhook processing creates only one payment and one set of tickets.
8. Confirm the booking email contains reference, contact, session, quantity, total paid, arrival instructions, expiry and a booking QR.
9. Open `/booking/:publicId` and confirm no private customer data is exposed.
10. Search/scan the booking as a cashier and register the party at reception.
11. Verify an individual admission as a supervisor without consuming it.
12. Redeem it once and confirm the second redemption returns `already_used`.
13. Confirm an admission cannot be redeemed before reception registration.
14. Test failed, abandoned, duplicate-webhook, expired-order, full-session, no-show and invalid-ticket cases.
15. Test on mobile and desktop.

### Phase E — prepare production services

Only after staging approval:

1. Decide whether production uses a separate Supabase project. It should not use staging test data.
2. Apply the same reviewed migrations to production.
3. Add the production Function secrets:
   - Paystack **live** secret key
   - Production ticket hash secret
   - Resend key and verified sender
   - `SITE_URL=https://cinemarepublicnaija.com`
   - `ALLOWED_ORIGINS=https://cinemarepublicnaija.com,https://www.cinemarepublicnaija.com`
4. Set the Paystack live webhook to the production Supabase project.
5. Add production Vercel `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` variables. Never put the Paystack secret in Vercel's browser variables.
6. Configure production Auth site/redirect URLs.
7. Create production staff accounts and minimum required roles.
8. Add real catalogue and capacity data.
9. Run a small real-money smoke test approved by the business, then immediately verify payment, email, QR, redemption and reconciliation.

### Phase F — public production launch

Set both feature switches to `true`, deploy through staging once more, get final approval, then merge staging into `main` using the release procedure below.

## 5. Current production deployment procedure

The current October 2026 release includes the HyperView live photos/videos and keeps both ticketing switches off.

### Step 1 — commit and deploy the staging branch

From the project folder:

```powershell
git branch --show-current
git status --short
npm.cmd run lint
npm.cmd run build
```

The branch must be `staging`. Review the file list, then commit all intended release files:

```powershell
git add -- public/9d-cinema src TICKETING_REACTIVATION_GUIDE.md
git diff --cached --stat
git diff --cached -- src/config/features.js
git commit -m "Launch HyperView update with online ticketing paused"
git push origin staging
```

Wait for the Vercel Preview deployment and test `https://staging.cinemarepublicnaija.com`.

### Step 2 — staging acceptance checklist

Confirm all of the following before merging:

- Home, About, Events, Partnership and Contact load on desktop and mobile.
- The Home and Events HyperView videos play.
- The three live HyperView photos load.
- The Partnership page uses real HyperView photos.
- Navigation contains no Movies link or ticket button.
- Home contains no Buy Tickets button or upcoming movie programme.
- Footer contains no digital-ticket banner or Movies link.
- `/movies`, `/movies/anything`, `/payment/callback`, `/ticket/anything`, `/admin` and `/admin/login` all return the visitor to `/`.
- Contact and existing event-enquiry flows still work.
- Browser console has no errors.

### Step 3 — merge the approved staging release into main

Make sure the working tree is clean after the staging commit:

```powershell
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
git merge --no-ff staging -m "Release HyperView launch with ticketing paused"
```

If Git reports a merge conflict, stop. Do not force the merge and do not use `git reset --hard`. Resolve and retest each conflict deliberately.

### Step 4 — test the exact main result locally

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run build
git status --short
```

`git status --short` should be empty. Confirm once more that both values in `src/config/features.js` are `false`.

### Step 5 — trigger the production deployment

```powershell
git push origin main
```

Vercel should deploy `main` to the production domain automatically. Do not run `vercel --prod` as a second deployment if Git integration is already working.

### Step 6 — production smoke test

In Vercel, wait for the deployment to show **Ready**, then test both:

- `https://cinemarepublicnaija.com`
- `https://www.cinemarepublicnaija.com`

Repeat the staging acceptance checklist. Use a private/incognito window so an old service worker or browser cache does not hide a problem.

### Step 7 — rollback if needed

For an urgent visual or routing failure, use Vercel's deployment rollback/promote-previous-deployment control first. This restores the last known deployment quickly without rewriting Git history.

Then create a normal Git revert for the release merge and push it:

```powershell
git log --oneline --merges -5
git revert -m 1 MERGE_COMMIT_SHA
git push origin main
```

Never use `git reset --hard` or force-push `main` for a production rollback.

## 6. Fast pause procedure after a future launch

If ticketing must be hidden again:

1. Set both flags in `src/config/features.js` to `false`.
2. Run lint and build.
3. Deploy to staging and verify the disabled-route checklist.
4. Merge to `main` and deploy.
5. If payments must stop at the server too, disable/guard `initialize-payment` or remove the live Paystack secret under an approved incident procedure.
6. Do not delete orders, payments or tickets; financial and admission records must be retained for reconciliation.
