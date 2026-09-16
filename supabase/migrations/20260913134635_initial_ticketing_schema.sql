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