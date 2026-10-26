-- Enum values must be committed before later migrations can safely use them.
alter type public.app_role add value if not exists 'cashier';
alter type public.app_role add value if not exists 'supervisor';

alter type public.screening_status add value if not exists 'in_progress';
alter type public.ticket_status add value if not exists 'no_show';
