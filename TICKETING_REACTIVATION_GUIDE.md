# Online Ticketing Pause and Reactivation Guide

Last updated: 11 October 2026

## 1. Current decision and release state

Cinema Republic's board has paused the public online movie-ticketing and payment launch. The implementation has **not** been deleted. It remains in this repository so it can be tested and reactivated later without rebuilding the system.

The production release must keep both switches in `src/config/features.js` set to `false`:

```js
export const PUBLIC_TICKETING_ENABLED = false;
export const TICKETING_ADMIN_ENABLED = false;
```

These switches are deliberately stored in source control instead of Vercel environment variables. This prevents an old or incorrectly scoped Vercel variable from unexpectedly enabling checkout in production.

## 2. What is currently disabled

### Public customer experience

When `PUBLIC_TICKETING_ENABLED` is `false`:

- The **Movies** navigation link is removed on desktop and mobile.
- The desktop **Get tickets** button is removed.
- The mobile **Browse movies & tickets** button is removed.
- The home-page **Buy movie tickets** CTA is removed.
- The home page no longer loads the upcoming-movies/screenings preview.
- The ticketing banner and **Movies & tickets** footer links are removed.
- `/movies` and every `/movies/:slug` booking URL redirect to `/`.
- `/payment/callback` redirects to `/`.
- `/ticket/:publicId` redirects to `/`.
- The public movie catalogue, checkout form and Supabase catalogue query are not loaded during a normal site visit.

General company language such as **host a screening**, past event screenings and contact enquiries remains visible. Those describe Cinema Republic's existing event services and do not start an online payment.

### Admin and staff experience

When `TICKETING_ADMIN_ENABLED` is `false`, every `/admin/...` URL redirects to `/`. The following code is preserved but unavailable through the deployed website:

- Admin authentication and role-based access control.
- Movie, venue, screening and ticket-tier management.
- Order and email-retry tools.
- Team invitation and role management.
- Staff ticket verification and redemption.

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
- `src/pages/CheckIn.jsx`
- `src/components/MovieCard.jsx`
- `src/components/MovieSneakPeek.jsx`
- `src/components/ticketing.css`
- `src/hooks/useMovieProgramme.js`
- `src/lib/catalog.js`
- `src/admin/`
- `supabase/`

## 4. Safe reactivation sequence

Do **not** enable public checkout directly in production. Reactivate it in staging first.

### Phase A — confirm business and account readiness

1. Get written approval to restart online ticketing.
2. Confirm the ticket prices, refund/cancellation rules, admission-opening time, venue timezone and customer-support contact.
3. Confirm who will hold these roles:
   - `admin`
   - `content_manager`
   - `check_in_staff`
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
   npx.cmd supabase functions deploy admin-orders
   ```

5. Confirm the Paystack **test-mode** webhook points to:

   ```text
   https://STAGING_PROJECT_REF.supabase.co/functions/v1/paystack-webhook
   ```

6. Confirm the pending-order and expired-ticket cron jobs are active.
7. Add one complete test programme: movie, poster, venue, future on-sale screening and at least one active ticket tier with capacity.
8. Confirm staging admin/staff accounts and role assignments.

### Phase C — enable the admin workspace on staging

In `src/config/features.js`, change only:

```js
export const TICKETING_ADMIN_ENABLED = true;
```

Keep `PUBLIC_TICKETING_ENABLED` false. Deploy to staging and verify:

- `/admin/login`
- Role-based navigation for admin, content manager and check-in staff.
- Movie/venue/screening/tier CRUD.
- Poster uploads.
- Order listing and email retry.
- Ticket verification and one-time redemption.

This order allows staff to prepare catalogue data without exposing checkout to customers.

### Phase D — enable public ticketing on staging

After the admin tests pass, change:

```js
export const PUBLIC_TICKETING_ENABLED = true;
```

Deploy to staging and confirm that Movies, ticket buttons, footer promotion and the home preview return automatically.

Run the complete customer test matrix:

1. Browse published movies and future on-sale screenings.
2. Verify coming-soon, sold-out and available states.
3. Select multiple ticket tiers and quantities.
4. Confirm prices are calculated by the database, in naira/kobo.
5. Complete a Paystack test payment.
6. Return to `/payment/callback` on the same staging hostname.
7. Confirm webhook processing creates only one payment and one set of tickets.
8. Confirm the ticket email arrives and its QR/link opens.
9. Verify the ticket as authenticated staff without consuming it.
10. Redeem it once and confirm the second redemption returns `already_used`.
11. Test failed, abandoned, duplicate-webhook, expired-order, sold-out and invalid-ticket cases.
12. Test on mobile and desktop.

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
