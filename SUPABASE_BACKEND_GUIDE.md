# Cinema57 Supabase backend and ticketing guide

This guide is the implementation blueprint for the current React ticket-booking UI. It covers the database, security, administration, Paystack payment flow, digital ticket email, ticket verification, check-in and expiry.

The movie listing and booking pages now read published movies with future `on_sale` screenings from Supabase, including a coming-soon preview before ticket sales open. The payment, ticket and staff flows are implemented locally but are **not live** until the migrations and Edge Functions are deployed, DNS/secrets are set, and Paystack test payments have passed. Do not accept real payments before the full test checklist passes.

## Hosting architecture: no separate Node.js server

This project does **not** require paid Node.js hosting, an Express server, a VPS or a server process that stays running.

| Part | Where it runs |
| --- | --- |
| React frontend | The site's existing static frontend host |
| Database | Supabase Postgres |
| Authentication and roles | Supabase Auth + Postgres RLS |
| Movie posters | Supabase Storage |
| Payment/order API | Supabase Edge Functions |
| Paystack webhook | Supabase Edge Function |
| Ticket verification/redemption API | Supabase Edge Functions |
| Order/ticket expiry and sold-out sync jobs | Supabase Cron + Postgres functions |

Supabase Edge Functions are server-side TypeScript functions running on a Deno-compatible managed runtime. Supabase hosts, scales and exposes their HTTPS URLs. They support npm packages and many Node APIs, but they are not a separately hosted Node/Express application.

Node.js is used only on your development computer because this existing React project uses npm/Vite and because `npx supabase ...` is a convenient way to run the Supabase CLI. Closing your computer does not stop the deployed backend.

If installing Docker for local Edge Function emulation is inconvenient, functions can also be created/deployed through the Supabase Dashboard. Local Docker is helpful for testing but is not another production hosting bill.

At the time this guide was updated, the Supabase Free plan listed 500,000 Edge Function invocations, a 500 MB database, 1 GB file storage and 5 GB egress. This is normally ample for a small MVP, but it has no paid uptime SLA and inactive free projects may be paused. Monitor usage and explain to the client that a successful live ticket business may eventually need a paid plan. Always confirm current limits on the official pricing page before launch.

## What the customer flow will do

1. The customer selects a movie, screening, ticket types and quantities.
2. They provide a name, phone number and email address.
3. The backend calculates the real price from the database and creates a temporary order.
4. Paystack collects payment.
5. A verified Paystack webhook changes the order to `paid` and creates one digital ticket per admission purchased.
6. An email provider sends the customer a receipt and QR ticket link.
7. Cinema57 staff scan the QR code at the venue.
8. The verification endpoint returns the paid movie, screening, ticket type and validity.
9. The check-in endpoint uses the ticket once. After the screening day, unused tickets become inactive and expired.

The payment callback page in the browser is not proof of payment. Only the webhook/server-side Paystack verification may create tickets.

## 1. Accounts and tools you need

- A Supabase project.
- A Paystack business account with test keys first.
- A Resend account and API key for transactional ticket delivery. Supabase Auth email is for authentication and should not be treated as the ticket-delivery system.
- Node.js on your own computer for the existing npm/Vite frontend and optional `npx` CLI commands. It is not production backend hosting.
- The Supabase CLI for migrations/functions, or the Supabase Dashboard if you prefer not to use the CLI.

Recommended CLI setup:

```bash
npm install @supabase/supabase-js
npx supabase login
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
```

The deployed backend functions will be TypeScript files under `supabase/functions/<function-name>/index.ts`. Use a separate `deno.json` per function to pin npm/JSR dependency versions. Do not build a separate Express application for this architecture.

Create `.env.local` for the React application:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Add `.env.local` to `.gitignore`. Only the publishable key belongs in React. Never put a Supabase secret/service-role key, Paystack secret key or email-provider key in a `VITE_` variable.

Set server-only Edge Function secrets:

```bash
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx
npx supabase secrets set SITE_URL=https://your-real-domain.com
npx supabase secrets set ALLOWED_ORIGINS=https://your-real-domain.com
npx supabase secrets set RESEND_API_KEY=re_your_real_resend_api_key
npx supabase secrets set EMAIL_FROM=tickets@your-real-domain.com
npx supabase secrets set TICKET_HASH_SECRET=a-long-random-secret
```

For local function testing, copy `supabase/functions/.env.example` to `supabase/functions/.env` and replace its placeholders. The real `.env` file is ignored by Git; never commit it.

## 2. Create the database

### Step 2A — run this in your terminal

From the Cinema57 project directory, create an empty migration file:

```bash
npx supabase migration new initial_ticketing_schema
```

The command creates a file similar to:

```text
supabase/migrations/20260913123456_initial_ticketing_schema.sql
```

### Step 2B — paste this into the generated `.sql` file

Open that new migration file in your code editor. Paste only the SQL block below into it and save the file. Do **not** paste these `create table` statements directly into PowerShell, Command Prompt or Bash.

Adjust required movie fields to match the final admin form if necessary.

```sql
create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'check_in_staff', 'content_manager', 'admin');
create type public.movie_status as enum ('draft', 'published', 'archived');
create type public.screening_status as enum ('draft', 'on_sale', 'sold_out', 'cancelled', 'completed');
create type public.order_status as enum ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded');
create type public.ticket_status as enum ('valid', 'used', 'expired', 'cancelled', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.movies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tagline text,
  synopsis text not null,
  poster_path text,
  backdrop_path text,
  genre text,
  rating text,
  language text not null default 'English',
  runtime_minutes integer check (runtime_minutes > 0),
  status public.movie_status not null default 'draft',
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  country text not null,
  timezone text not null default 'Africa/Lagos',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete restrict,
  venue_id uuid not null references public.venues(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sales_start timestamptz not null,
  sales_end timestamptz not null,
  status public.screening_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (sales_end > sales_start)
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  screening_id uuid not null references public.screenings(id) on delete cascade,
  name text not null,
  description text,
  price_kobo bigint not null check (price_kobo >= 0),
  capacity integer not null check (capacity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (screening_id, name)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  currency text not null default 'NGN',
  amount_kobo bigint not null check (amount_kobo >= 0),
  status public.order_status not null default 'pending',
  access_token_hash text not null,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 8),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, ticket_type_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'paystack',
  provider_reference text not null unique,
  currency text not null,
  amount_kobo bigint not null,
  status text not null,
  verified_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  screening_id uuid not null references public.screenings(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  holder_name text not null,
  holder_email text not null,
  status public.ticket_status not null default 'valid',
  is_active boolean not null default true,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until > valid_from)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_key text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  recipient text not null,
  template text not null,
  provider_message_id text,
  status text not null default 'pending',
  last_error text,
  attempts integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index screenings_movie_start_idx on public.screenings(movie_id, starts_at);
create index ticket_types_screening_idx on public.ticket_types(screening_id);
create index orders_customer_idx on public.orders(user_id, created_at desc);
create index orders_status_expiry_idx on public.orders(status, expires_at);
create index tickets_screening_idx on public.tickets(screening_id);
create index tickets_validity_idx on public.tickets(is_active, valid_until);
```

### Step 2C — return to your terminal

After saving the `.sql` file, push the migration to the linked Supabase project:

```bash
npx supabase db push
```

Alternative: instead of Steps 2A–2C, you can paste the same SQL block into **Supabase Dashboard → SQL Editor → New query** and click **Run**. The migration-file method is recommended because it keeps the database structure versioned with the project. Choose one method; do not run both against the same fresh project.

All database and Paystack amounts are stored/sent as integer **kobo**. Never store naira prices as floating-point values. Convert only for display in React: `displayNaira = amount_kobo / 100`.

### Why tickets have both `status` and `is_active`

`is_active` answers the quick gate question: can this ticket possibly be accepted? `status` explains why it cannot be accepted: `used`, `expired`, `cancelled` or `refunded`.

Do not delete the ticket or ticket ID after the event. Keep it for payment and attendance audits. The ticket becomes invalid when any of these is true:

- `is_active = false`
- `status <> 'valid'`
- current time is before `valid_from`
- current time is at or after `valid_until`
- its screening was cancelled
- its order is no longer paid

Set `valid_until` to the end of the screening day in the venue's timezone, or to a clearly agreed grace period after `ends_at`. For Cinema57, “midnight at the venue after the screening” is a simple policy.

## 3. Roles and permissions

### Where the SQL in Sections 3–5 goes

If `initial_ticketing_schema.sql` has **not** been pushed yet, you may append the audit-table, profile-trigger, RLS and policy SQL blocks to that migration and then run `npx supabase db push` once.

If the initial migration **has already been pushed**, do not edit it. Create a second migration from the terminal:

```bash
npx supabase migration new add_roles_profiles_and_rls
```

Open the newly created file under `supabase/migrations/`, paste the executable SQL blocks from Sections 3–5 into that file, save it, and run:

```bash
npx supabase db push
```

Supabase records which migrations have already run, so `db push` applies only the new migration. Headings, explanations and bullet lists are not SQL and must not be pasted into migration files.

The one-time `update public.profiles set role = 'admin' ...` command is intentionally different: do not add that account-specific command to a migration. Run it later in the Supabase Dashboard SQL Editor after your user has signed up and a `profiles` row exists.

Do not use one broad “staff” role for unrelated responsibilities. A gate worker should not be able to change movie prices, and a content editor should not be able to promote themselves to admin.

| Role | Intended access |
| --- | --- |
| `customer` | View published movies; guest checkout/status uses private order access tokens. A signed-in order history is a separate future feature. |
| `check_in_staff` | Sign in to the check-in screen, search limited ticket details, verify and redeem tickets |
| `content_manager` | Create/edit/publish movies, venues, screenings and ticket types; no private order/payment access |
| `admin` | Everything above, plus invite staff, assign/revoke roles and view full orders/payments. Refunds are initiated in Paystack Dashboard; confirmed full-refund webhooks reconcile orders/tickets. |

Only `admin` should assign roles. Creating or changing roles is not a low-risk operation: letting a lower role assign roles can become a privilege-escalation path.

If the team is initially very small, start with `admin` and `check_in_staff`. Add `content_manager` when someone needs to maintain the programme without receiving access to customer/payment administration.

### Permission rules

- `check_in_staff` cannot create movies, change prices, view Paystack payloads, issue refunds or manage users.
- `content_manager` cannot verify/redeem tickets, view full customer/payment records or manage users.
- `admin` can invite operational users and choose either operational role.
- No user, including an admin, should change their own role directly from the browser.
- Role changes go through the admin-only `admin-team` Edge Function, which checks the caller's JWT/current database role and invokes an audited service-role-only database function. Invitations use the server-side Supabase Auth Admin API.
- Record role assignments in an audit table with `changed_by`, `target_user`, `old_role`, `new_role` and `changed_at`.

An optional audit table:

```sql
create table public.role_audit_log (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid not null references auth.users(id),
  target_user uuid not null references auth.users(id),
  old_role public.app_role,
  new_role public.app_role not null,
  changed_at timestamptz not null default now()
);

alter table public.role_audit_log enable row level security;
```

## 4. Automatically create user profiles

This trigger does not create a login by itself. Supabase Auth first creates a row in the protected `auth.users` table when someone signs up or accepts a staff invitation. PostgreSQL then supplies that new row to the trigger as `new`:

- `new.id` is the Auth user's UUID.
- `new.email` is managed by Supabase Auth and does not need to be duplicated in `profiles`.
- `new.raw_user_meta_data` contains optional signup metadata such as `full_name`.
- Password hashes, sessions and email confirmation state remain managed by Supabase Auth. Never store passwords in `public.profiles`.

The trigger copies only the safe application fields into `public.profiles`. The default database role is always `customer`; never accept a role from user-controlled signup metadata.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

For example, a React signup form supplies the real email/password to Supabase Auth and the name as metadata:

```js
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,
    },
  },
});
```

That single signup produces:

```text
auth.users
  id, email, encrypted password, confirmation/session data, raw_user_meta_data

public.profiles
  same id, full_name, role='customer'
```

Operational accounts (`check_in_staff`, `content_manager`, `admin`) use this Auth/profile pairing. Ordinary movie-ticket buyers may continue as guests: their checkout name, email and phone are stored on `orders`, while `tickets` stores the holder name/email snapshot. A guest purchase does not need an `auth.users` or `profiles` row.

If an Auth user existed before the trigger was installed, the trigger will not run retroactively. Create the missing profile once in the SQL Editor:

```sql
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data->>'full_name', '')
from auth.users
on conflict (id) do nothing;
```

After creating your own account, promote it once from the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
```

Normal users must never be able to change their own `role`.

## 5. Enable Row Level Security

Enable RLS on every table in `public`:

```sql
alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.venues enable row level security;
alter table public.screenings enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.tickets enable row level security;
alter table public.webhook_events enable row level security;
alter table public.email_deliveries enable row level security;
```

Create separate permission helpers instead of one helper that grants every operational permission:

```sql
create or replace function public.can_check_in()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('check_in_staff', 'admin')
  );
$$;

create or replace function public.can_manage_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('content_manager', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
```

Current browser/API policy state after `20260916130000_screening_inventory.sql` is pushed:

- `anon` and `authenticated`: select published movies.
- `anon` and `authenticated`: select future `on_sale` and `sold_out` screenings for published movies at active venues, including screenings whose sales window has not opened. Active ticket types and remaining counts remain hidden until `sales_start`; checkout remains blocked by the database function until then.
- Orders and tickets are not directly readable from the browser in this guest-checkout MVP. Guest status uses the secret-token Edge Function, and the ticket page uses a safe-detail Edge Function. Add separate owner-only RLS policies if signed-in order history is built later.
- Check-in staff receive only safe gate data through authenticated verification/redemption Edge Functions; raw ticket/order tables remain closed to browser roles.
- Content managers can read/create/edit catalogue rows through role-checked RLS and the implemented `/admin/movies`, `/admin/venues` and `/admin/screenings` forms.
- Admins can search orders, inspect payment/email/refund events, retry failed ticket email, and invite/change team roles through server-only endpoints. Refund initiation remains in Paystack Dashboard; confirmed full-refund webhooks mark orders/tickets refunded.
- Browser roles have no direct payment, webhook, email-delivery, order or issued-ticket writes.
- Guest order status: available only through an Edge Function using the secret access token returned during checkout.

The migration contains the actual least-privilege policies and grants. This public movie policy illustrates its pattern:

```sql
create policy "published movies are public"
on public.movies for select
to anon, authenticated
using (status = 'published');
```

Catalogue update policy example:

```sql
create policy "catalogue team edits movies"
on public.movies for update
to authenticated
using (public.can_manage_catalog())
with check (public.can_manage_catalog());
```

Do not paste these examples again if the migration is pushed. The SQL smoke tests cover anonymous catalogue access and gate-role denial locally; still test actual Supabase Auth roles and Dashboard behaviour in the hosted project before launch.

## 6. Configure poster storage

### What runs where in sections 6-9

| Task | Where you do it | Ready to run now? |
| --- | --- | --- |
| Create the `movie-posters` bucket | Supabase Dashboard -> Storage | Yes |
| Add poster access policies | A local migration SQL file, then `npx supabase db push` | Yes; SQL is below |
| Build `/admin/...` screens | This React project's source code | No command; this is frontend development |
| Create the atomic payment workflow | Local migration SQL files, then `npx supabase db push` | Implemented in `20260913160000...` and `20260913160100...` |
| Create `expire_pending_orders()` | A local migration SQL file, then push | Already implemented |
| Schedule pending-order cleanup | Supabase Dashboard -> Integrations -> Cron | Yes, after the SQL function is pushed |
| Run `supabase functions new ...` | Terminal in the project root | Already completed |
| Implement each Edge Function | Its `supabase/functions/<name>/index.ts` file | Implemented; section 9 explains deployment |

Do not paste the tables, numbered requirements, example request JSON or example response JSON into the SQL Editor. The executable SQL and TypeScript are already stored in the project files identified below.

### 6.1 Create the bucket in the Dashboard

1. Open your Supabase project at `https://supabase.com/dashboard`.
2. In the left sidebar, open **Storage**.
3. Click **New bucket**.
4. Enter the exact name `movie-posters`.
5. Turn **Public bucket** on. Posters are public marketing assets, so they do not need expiring signed URLs.
6. If the form offers file restrictions, use a maximum size such as `5 MB` and allow `image/jpeg`, `image/png`, `image/webp` and `image/avif`.
7. Click **Create bucket**.

Making the bucket public allows anyone to view a poster. It does **not** allow anyone to upload, replace or delete files; those operations still require Storage RLS policies.

### 6.2 Add the Storage policies from the CLI

If your existing schema migration has already been pushed, create a new migration from the terminal in the project root:

```bash
npx supabase migration new movie_poster_storage_policies
```

Open the newly created `.sql` file under `supabase/migrations/`, paste in the following SQL, save it, and then push it:

```sql
create policy "catalogue team can list movie posters"
on storage.objects for select
to authenticated
using (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
);

create policy "catalogue team can upload movie posters"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
);

create policy "catalogue team can update movie posters"
on storage.objects for update
to authenticated
using (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
)
with check (
  bucket_id = 'movie-posters'
  and public.can_manage_catalog()
);

create policy "admins can delete movie posters"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'movie-posters'
  and public.is_admin()
);
```

```bash
npx supabase db push
```

If the original schema has **not** been pushed yet, you may instead add this SQL to the bottom of that unpushed migration and push once. The permission helpers from section 5 must exist before these policies are created.

### 6.3 How poster uploads work later

This illustrates the upload used by the implemented admin movie form; it is React/JavaScript, not SQL, and should not go in a migration:

```js
const objectPath = `movies/${movieId}/${crypto.randomUUID()}-${file.name}`;

const { error: uploadError } = await supabase.storage
  .from('movie-posters')
  .upload(objectPath, file, { cacheControl: '3600', upsert: false });

if (uploadError) throw uploadError;

const { error: movieError } = await supabase
  .from('movies')
  .update({ poster_path: objectPath })
  .eq('id', movieId);

if (movieError) throw movieError;
```

Store only the object path, such as `movies/MOVIE_UUID/random-name.webp`, in `movies.poster_path`. To display it later:

```js
const { data } = supabase.storage
  .from('movie-posters')
  .getPublicUrl(movie.poster_path);

const posterUrl = data.publicUrl;
```

## 7. Build the admin and staff areas

These screens are implemented locally. Catalogue forms use Supabase's Data API under RLS; private order and team operations use staff-JWT-protected Edge Functions. No privileged key is shipped to the browser.

Routes (one shared staff login):

- `/admin/login`
- `/admin` — role-based landing page
- `/admin/movies`
- `/admin/movies/new`
- `/admin/movies/:id`
- `/admin/venues`
- `/admin/screenings`
- `/admin/screenings/:id`
- `/admin/orders`
- `/admin/team`
- `/admin/check-in`

`check_in_staff` sees only Overview and Check-in. `content_manager` sees Overview, Movies, Venues and Screenings. `admin` sees all sections. Route guards shape the UI, while database RLS and each Edge Function enforce authorization independently.

Admin capabilities:

- Create, edit, publish, archive and feature movies.
- Upload movie poster/backdrop images.
- Create venues and screenings.
- Configure dates, prices, capacities and ticket tiers.
- Pause sales, cancel screenings or mark them sold out.
- Search by order reference, customer email or ticket public ID.
- View payment and email-delivery status.
- Invite check-in staff/content managers and change or revoke their roles from `/admin/team`.
- Retry a failed ticket email without changing the paid order.
- View the latest Paystack refund event. Initiate refunds in Paystack Dashboard, not from this app; a confirmed full `refund.processed` webhook invalidates tickets. Partial refunds require manual review.

Before using Team invitations, set Supabase Dashboard -> Authentication -> URL Configuration -> Site URL to `https://cinemarepublicnaija.com` and allow `https://cinemarepublicnaija.com/admin/login?invite=1` as a redirect URL. Staff invitations use Supabase Auth email delivery, which is separate from Resend ticket mail; configure Auth SMTP for reliable real-world invitations. Invitees follow the link to set a password of at least 12 characters. An admin account must first be bootstrapped once with the SQL in section 4; the app intentionally cannot create its first admin.

The check-in experience should be optimized for a phone:

1. Staff sign in and open `/admin/check-in`.
2. They scan the QR code or enter the public ticket ID manually.
3. The app calls `verify-ticket` and shows a large result state.
4. A valid result shows the movie poster/title, date, time, venue, ticket type and holder name.
5. Staff press **Redeem ticket** to call `redeem-ticket`.
6. The success state shows “Admit guest” and the check-in time.
7. Scanning the same ticket again shows “Already used” and its original check-in time.

Keep manual redemption as the safe default. An optional high-volume “scan and redeem” mode may be added later, but it should require an explicit setting and provide a strong success/failure signal after every scan.

Never hard-delete paid orders, payments or tickets from the admin UI. Use statuses so there is an audit history. After tickets have sold, the database blocks rescheduling or moving a screening and blocks reducing a ticket tier below paid/live-reserved capacity. Cancelling a screening invalidates tickets but **does not automatically refund customers**; process the refund separately in Paystack.

Each ticket tier is a different admission category for the **same** screening (for example, General and VIP), and its capacity is the number of admissions in that category. A tier is temporarily unavailable when paid tickets plus live pending checkout holds reach its capacity. The screening becomes `sold_out` only when **every active tier** has no unsold places based on paid orders. After the scheduled `ends_at`, an `on_sale` or `sold_out` screening automatically becomes `completed`; draft and cancelled screenings are left alone. Completion does not invalidate already-issued tickets or issue refunds.

Migration `20260916130000_screening_inventory.sql` adds the public remaining-count RPC and `sync_screening_sold_out_status()`. It runs the sync once immediately and schedules `sync-screening-inventory` every minute if Supabase Cron is already enabled. After `db push`, verify this job in **Dashboard → Integrations → Cron → Jobs**. If absent, enable Cron and create a SQL job named `sync-screening-inventory` with schedule `* * * * *` and command `select public.sync_screening_sold_out_status();`. Pending holds are intentionally excluded from the persisted `sold_out` status so abandoned checkouts cannot permanently close a screening. The public remaining count includes live holds. Raising a tier's capacity or a full refund can automatically reopen a sold-out screening at the next sync, provided the sales window is still open.

Migration `20260916140000_auto_complete_screenings.sql` adds `sync_completed_screenings()`, backfills ended showings once, and schedules `complete-finished-screenings` every minute if Cron is already enabled. Verify that job in **Dashboard → Integrations → Cron → Jobs** too. If absent, create it with schedule `* * * * *` and SQL command `select public.sync_completed_screenings();`. The job changes the screening status after `ends_at`; ticket verification still follows each ticket's own `valid_until` and cancellation/refund rules.

## 8. Create orders safely and reserve capacity

The complete order/payment SQL is now in these migration files:

```text
supabase/migrations/20260913160000_add_payment_review_status.sql
supabase/migrations/20260913160100_payment_workflow.sql
```

The workflow migration provides:

- Persistent checkout/status rate limiting.
- `create_pending_order(...)`, which locks ticket types, checks the sale window and capacity, loads prices from the database, creates a ten-minute reservation and stores only the hash of the order access token.
- `process_paystack_charge_success(...)`, which atomically records a payment, prevents duplicate webhook processing and issues exactly the purchased number of tickets.
- A `payment_review` state for a successful but mismatched or no-longer-fulfillable payment. This prevents silent overbooking and allows an admin to investigate/refund it.
- `get_order_status_by_token(...)`, which exposes an order only when the caller supplies the correct secret token.
- A hardened `expire_pending_orders()` that also cleans old rate-limit records.

The browser sends only ticket type IDs, quantities and customer details. It never supplies an authoritative price. The raw access token is generated by the Edge Function, while Postgres receives and stores only its HMAC hash.

From the project root, push both new migrations:

```bash
npx supabase db push
```

Then keep the existing expiry schedule in the Supabase Dashboard:

1. Open **Integrations -> Cron**. If Cron is not enabled, enable the integration first.
2. Open **Jobs**, choose **Create job**, and name it `expire-pending-orders`.
3. Use the cron schedule `*/5 * * * *` to run every five minutes.
4. Choose the SQL/database-function option and enter `select public.expire_pending_orders();`.
5. Save the job.

The scheduled job only changes stale order statuses. Capacity calculations must still ignore expired pending orders even if the job is delayed.

## 9. Create the Paystack functions

The three functions have now been implemented in:

```text
supabase/functions/initialize-payment/index.ts
supabase/functions/paystack-webhook/index.ts
supabase/functions/order-status/index.ts
```

Shared production helpers live under `supabase/functions/_shared/`. They provide strict JSON/body validation, origin controls, cryptography, a server-only Supabase client, rate-limit keys and Resend ticket-email generation. `supabase/config.toml` already sets `verify_jwt = false` for the three guest/external endpoints; each endpoint applies its own appropriate security checks.

Do not run `supabase functions new` for these names again because that could replace or conflict with the implemented files. The request and response below show how the frontend communicates with the functions; they are not commands to paste into SQL.

### `initialize-payment`

Request:

```json
{
  "screening_id": "uuid",
  "items": [{ "ticket_type_id": "uuid", "quantity": 2 }],
  "customer": {
    "name": "Amina Bello",
    "email": "amina@example.com",
    "phone": "+2348000000000"
  }
}
```

The implemented function:

1. Validate types, email, phone, quantity and request size.
2. Rate-limit repeated requests.
3. Call `create_pending_order` so Postgres calculates availability and price.
4. Send the stored amount in kobo to Paystack's Initialize Transaction endpoint. For example, ₦5,000 is sent as `500000` kobo.
5. Set the unique order reference and `${SITE_URL}/payment/callback`.
6. Store only necessary metadata; do not put sensitive data in Paystack metadata.
7. Return Paystack's authorization URL/access code plus the guest order-status token.

Response:

```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "...",
  "reference": "C57-...",
  "order_access_token": "high-entropy-private-token",
  "expires_at": "2026-09-13T16:10:00.000Z"
}
```

### `paystack-webhook`

This endpoint is public because Paystack calls it. The implemented handler:

1. Read the raw request body.
2. Calculate HMAC-SHA512 with `PAYSTACK_SECRET_KEY`.
3. Compare the result to `x-paystack-signature` before parsing/processing the event.
4. For `charge.success`, locate the order by reference.
5. Confirm Paystack reports `success` and confirm amount and currency exactly match the stored order.
6. Create a unique webhook key from the Paystack event and order reference and refuse to process it twice.
7. In one database transaction, insert the payment, mark the order paid and create individual tickets.
8. For each ticket, set:
   - `is_active = true`
   - `status = 'valid'`
   - `valid_from` to the venue admission/opening time
   - `valid_until` to midnight after the screening in the venue timezone
9. Queue/send the ticket email only after the payment transaction commits.
10. Return HTTP 200 quickly so Paystack does not repeatedly retry a successfully handled event.

Idempotency is essential: receiving the same webhook twice must not issue duplicate tickets.

### `order-status`

The payment callback page calls this endpoint with the order reference and guest access token. Hash the provided token and compare it with `access_token_hash`.

Return `pending`, `paid`, `failed`, `expired` or `payment_review` plus issued ticket links. Never mark the order paid merely because the callback page was opened. The frontend must keep the returned order access token in `sessionStorage` before redirecting to Paystack; do not put that private token in a URL or Paystack metadata.

## 10. Digital ticket email with Resend

Read the key only inside the server-side email helper `supabase/functions/_shared/ticket-email.ts` (called after the verified payment webhook commits):

```ts
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const emailFrom = Deno.env.get('EMAIL_FROM');
```

Before emailing real customers, add a domain or sending subdomain in Resend and add the provided SPF/DKIM DNS records at your domain provider. `EMAIL_FROM` must use that verified domain, for example `Cinema Republic <tickets@mail.cinemarepublic.example>`.

Each paid admission gets its own QR code. Encode a URL such as:

```text
https://your-real-domain.com/ticket/PUBLIC_TICKET_UUID
```

The current email contains:

- Movie title (poster artwork is not yet embedded in the email).
- Screening date/time with timezone.
- Venue name/address.
- Ticket type.
- Order reference.
- QR code and human-readable `public_id`.
- A reminder that each ticket admits one guest once. Add client-approved arrival/refund links before live launch.

Do not encode private customer/payment data inside the QR image. The QR should contain only the opaque ticket URL or public ID.

Record each send attempt in `email_deliveries`. If sending fails, the payment and tickets must remain valid; retry delivery and allow staff to search the order manually.

## 11. Ticket verification endpoint

Implemented in `supabase/functions/verify-ticket/index.ts`, its shared staff-auth handler, and `supabase/migrations/20260915110000_ticket_gate_and_catalog.sql`. Do **not** scaffold this function again.

Use `POST`, not a query-string `GET`, so ticket codes do not appear in ordinary URL/server logs.

Endpoint:

```text
POST /functions/v1/verify-ticket
Authorization: Bearer STAFF_SUPABASE_JWT
Content-Type: application/json
```

Request:

```json
{ "ticket_id": "PUBLIC_TICKET_UUID" }
```

The implemented verification algorithm:

1. Validate the staff JWT.
2. Check the caller's current `profiles.role` is `check_in_staff` or `admin`, matching `public.can_check_in()`; the SQL RPC checks that role again inside its transaction.
3. Call service-role-only `verify_ticket_staff`, which locks the ticket, joins its order, screening, movie, venue and ticket type, and writes an audit row.
4. If no row exists, return HTTP 404 and `{ "valid": false, "reason": "not_found" }`.
5. Confirm the order is paid and screening is not cancelled.
6. Check `is_active`, ticket `status`, `valid_from` and `valid_until`.
7. If `now() >= valid_until`, update the ticket to `status='expired', is_active=false`, then return it as expired.
8. Return safe movie/screening/ticket details. Do not return Paystack payloads or unnecessary personal data.

Valid response example:

```json
{
  "valid": true,
  "reason": "valid",
  "ticket": {
    "id": "public-ticket-uuid",
    "type": "Premium lounger",
    "holder_name": "Amina Bello",
    "status": "valid",
    "valid_until": "2026-09-19T00:00:00Z"
  },
  "movie": {
    "title": "Legends of the Coast",
    "poster_url": "https://...",
    "rating": "12A",
    "runtime_minutes": 128
  },
  "screening": {
    "starts_at": "2026-09-18T19:00:00Z",
    "ends_at": "2026-09-18T21:08:00Z",
    "venue": "Cinema Republic Open-Air Cinema, Lagos"
  }
}
```

Invalid responses should use stable reasons such as:

- `not_found`
- `not_yet_valid`
- `expired`
- `already_used`
- `cancelled`
- `refunded`
- `order_not_paid`

This endpoint has `verify_jwt = true`; the handler also validates the user through Supabase Auth, checks the role, rate-limits scans and records outcomes in `ticket_gate_audit_log`. Browser roles cannot call the gate RPC directly.

## 12. Ticket check-in endpoint

Implemented separately in `supabase/functions/redeem-ticket/index.ts` and `public.redeem_ticket_staff`. Verification never consumes a ticket. The staff UI shows an explicit **Redeem & admit guest** button only after a valid verification.

Recommended endpoint:

```text
POST /functions/v1/redeem-ticket
Authorization: Bearer STAFF_SUPABASE_JWT

{ "ticket_id": "PUBLIC_TICKET_UUID" }
```

The database update is atomic and uses the validated staff user ID. The Edge Function calls this service-role-only SQL RPC after validating the staff JWT and role:

```sql
update public.tickets
set
  status = 'used',
  is_active = false,
  checked_in_at = now(),
  checked_in_by = :validated_staff_user_id
where public_id = :ticket_id
  and status = 'valid'
  and is_active = true
  and now() >= valid_from
  and now() < valid_until
returning *;
```

The SQL function locks the row and rechecks order/screening/ticket state before the conditional update. Only the first valid redemption succeeds; a second scan returns `already_used` and the original check-in time. Both attempts are audited.

## 13. Expire tickets automatically

Implemented in the ticket-gate migration. Verification and redemption always compare the ticket validity window using database time, so expiry remains secure even if a scheduled job is late. The cleanup function is:

```sql
create or replace function public.expire_old_tickets()
returns void
language sql
security definer
set search_path = public
as $$
  update public.tickets
  set status = 'expired', is_active = false
  where is_active = true
    and status = 'valid'
    and valid_until <= now();
$$;
```

After pushing the migration, open **Supabase Dashboard → Integrations → Cron**. Enable Cron if needed, create a SQL job named `expire-old-tickets`, choose `*/10 * * * *` (every ten minutes), and enter `select public.expire_old_tickets();`. The migration also has triggers that set `is_active=false` when a paid order is refunded/cancelled or a screening is cancelled; redemption does so for used tickets.

## 14. Connect the React frontend

Implemented locally:

1. `src/lib/supabase.js` uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; put these in the frontend host's environment settings and your local `.env.local`.
2. The movie listing, home sneak peek and booking page query Supabase screenings. Published movies with future `on_sale` screenings appear as coming soon before `sales_start`; `sold_out` screenings remain visible without checkout. Ticket tiers and remaining-count data are exposed only after sales open. Movies without a future `on_sale` or `sold_out` screening do not appear in the public programme.
3. Booking calls `initialize-payment` with screening/ticket IDs and quantities, saves the private guest order token in `sessionStorage`, and redirects to the validated Paystack checkout URL. The browser's displayed subtotal is informational; Postgres computes the payable price.
4. `/payment/callback` polls `order-status` for roughly 30 seconds and never marks an order paid itself. The token is not placed in the Paystack callback URL.
5. `/ticket/:publicId` calls the public, rate-limited `ticket-details` Edge Function, which returns safe movie/screening/ticket metadata and a QR image. It never returns holder email, order or Paystack fields.
6. `/admin/login` is the shared Supabase Auth sign-in. Role-aware admin navigation includes `/admin/check-in`, which checks the user's staff role, supports camera QR scanning on browsers with `BarcodeDetector` and manual link/UUID entry everywhere, then verifies and explicitly redeems. Camera access requires HTTPS and browser support; test the exact phones your staff will use.

The `movie-posters` bucket must be **public** for the poster URLs shown by the site. Its uploads remain restricted to catalogue roles by Storage policies. If no poster exists, the site uses local fallback artwork.

Create the **first admin** in **Supabase Dashboard → Authentication → Users**, not by inserting into `profiles`. The Auth trigger creates its profile. Promote that account once in the SQL Editor after confirming its email:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL_HERE');
```

Only trusted project operators should run this bootstrap SQL. Thereafter, invite staff and assign roles at `/admin/team`. Ordinary customers cannot promote themselves.

Your static frontend host must serve `index.html` for unknown paths (SPA fallback/rewrite). Otherwise Paystack's direct `/payment/callback` visit and emailed `/ticket/:publicId` links can 404 even though React has routes for them. Configure this in the hosting platform before testing payments.

## 15. Deploy the functions

The webhook and guest checkout/status functions must accept unauthenticated external requests, then perform their own strict validation. Staff verification/check-in functions should require Supabase JWT authentication.

```bash
npx supabase functions deploy initialize-payment
npx supabase functions deploy paystack-webhook
npx supabase functions deploy order-status
```

The three payment functions already have `verify_jwt = false` in `supabase/config.toml`, so the deployment flag does not need to be repeated.

Also deploy the now-implemented staff and safe public ticket-view functions:

```bash
npx supabase functions deploy verify-ticket
npx supabase functions deploy redeem-ticket
npx supabase functions deploy ticket-details
```

`verify-ticket` and `redeem-ticket` have `verify_jwt = true` in `supabase/config.toml`; `ticket-details` has `verify_jwt = false` and performs UUID validation/rate limiting itself. Deploy the migration **before** these functions. Do not use `--no-verify-jwt` for the staff functions.

The admin screens add two JWT-protected functions and two database migrations. From the project root, review the dry run, push the new migrations, then deploy:

```powershell
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
npx.cmd supabase functions deploy admin-team
npx.cmd supabase functions deploy admin-orders
npx.cmd supabase functions deploy paystack-webhook
```

The final webhook redeploy is needed because it now handles `refund.pending`, `refund.processing`, `refund.needs-attention`, `refund.failed` and `refund.processed` as well as `charge.success`. Both admin functions keep `verify_jwt = true`. Never put a Supabase secret key in a `VITE_` variable. To test invitations locally, add `http://localhost:5173/admin/login?invite=1` to Supabase Auth redirect URLs.

In the Paystack dashboard, set the webhook URL to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook
```

Use only Paystack test keys until all test cases pass.

## 16. Test before accepting real payments

- Successful card payment creates the correct number of tickets.
- Amount and currency mismatches create no tickets.
- Visiting the callback without payment creates no tickets.
- Duplicate webhooks create no duplicate payment or tickets.
- Failed/abandoned payment releases capacity after order expiry.
- Two buyers attempting the last ticket cannot both purchase it.
- A valid ticket returns the correct movie, showtime, venue and ticket tier.
- A ticket cannot be redeemed twice.
- An expired ticket returns `expired` even before the cleanup job runs.
- Expiry sets `is_active=false` and `status='expired'`.
- Cancelled/refunded tickets become inactive.
- Customers and content managers cannot verify or redeem tickets.
- Check-in staff cannot change movies, ticket prices, payments or roles.
- Content managers cannot view complete customer/payment data or assign roles.
- Only admins can assign/revoke operational roles, and every change is audited.
- An admin invitation leads to `/admin/login?invite=1`, where the invitee sets a password and sees only sections allowed by their role.
- Sold screening film/venue/time cannot be changed; ticket tier capacity cannot drop below already sold or live-reserved quantity.
- A signed `refund.processed` event for the full paid amount marks the order and tickets refunded; partial refunds remain for manual review.
- Email failure is retryable and does not erase a paid ticket.
- The site works with Paystack test callback/webhook delays.

## 17. Final launch decisions

Confirm these with the client before launch:

- Real movies and legal poster/licensing rights.
- Ticket prices, capacity and maximum order quantity.
- Whether validity ends at midnight or after a fixed post-screening grace period.
- Venue/address and timezone.
- Correct Nigerian venue, naira pricing and contact information.
- Refund, cancellation, privacy and event-entry policies.
- Which staff accounts may scan/redeem tickets.
- The verified Resend sending domain and final `EMAIL_FROM` address.

## Official references

- Supabase database: https://supabase.com/docs/guides/database/overview
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API security: https://supabase.com/docs/guides/api/securing-your-api
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Edge Function quickstart: https://supabase.com/docs/guides/functions/quickstart
- Supabase Edge Function dependencies: https://supabase.com/docs/guides/functions/dependencies
- Supabase Edge Function pricing: https://supabase.com/docs/guides/functions/pricing
- Supabase plan pricing and limits: https://supabase.com/pricing
- Supabase Resend email example: https://supabase.com/docs/guides/functions/examples/send-emails
- Resend domain verification: https://resend.com/docs/dashboard/domains/introduction
- Supabase function authentication: https://supabase.com/docs/guides/functions/auth
- Supabase function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase Cron: https://supabase.com/docs/guides/cron
- Paystack payment flow: https://paystack.com/docs/payments/accept-payments/
- Paystack payment verification: https://paystack.com/docs/payments/verify-payments/
- Paystack webhooks: https://paystack.com/docs/payments/webhooks/
