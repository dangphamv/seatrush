create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  venue text not null,
  starts_at timestamptz not null,
  sales_open_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'on_sale', 'closed')),
  created_at timestamptz not null default now()
);
create index events_listing on events (status, sales_open_at);

create table sections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  name text not null,
  price_vnd bigint not null check (price_vnd > 0),
  sort int not null default 0,
  unique (event_id, name)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  -- orderCode cho PayOS: số nguyên dương, duy nhất.
  code bigint generated always as identity (start with 100001) unique,
  event_id uuid not null references events on delete cascade,
  section_id uuid not null references sections on delete cascade,
  client_id uuid not null,
  idempotency_key text not null,
  email text not null,
  quantity int not null check (quantity between 1 and 4),
  amount_vnd bigint not null check (amount_vnd > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'refund_required')),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, idempotency_key)
);
create index orders_expiring on orders (expires_at) where status = 'pending';
create index orders_email_event on orders (event_id, lower(email)) where status in ('pending', 'confirmed');

create table seats (
  id bigint generated always as identity primary key,
  event_id uuid not null references events on delete cascade,
  section_id uuid not null references sections on delete cascade,
  row_label text not null,
  -- row_no để sắp thứ tự hàng (row_label 'AA' đứng sau 'Z', sắp chuỗi thì sai).
  row_no int not null,
  seat_no int not null,
  status text not null default 'available' check (status in ('available', 'held', 'sold')),
  order_id uuid references orders on delete set null,
  held_until timestamptz,
  unique (section_id, row_no, seat_no),
  check ((status = 'available') = (order_id is null))
);
-- Tìm ghế còn giữ được theo đúng thứ tự cấp ghế: chỉ index phần chưa bán.
create index seats_open on seats (section_id, row_no, seat_no) where status <> 'sold';
create index seats_order on seats (order_id) where order_id is not null;

create table tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  seat_id bigint not null references seats on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  -- Lớp chặn cuối cùng: một ghế không bao giờ có 2 vé.
  unique (seat_id)
);
create index tickets_order on tickets (order_id);

create table payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_ref text not null,
  order_id uuid references orders on delete set null,
  amount_vnd bigint not null,
  outcome text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  -- Webhook đến 2 lần chỉ được ghi 1 lần.
  unique (provider, provider_ref)
);

create table outbox (
  id bigint generated always as identity primary key,
  topic text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index outbox_unpublished on outbox (id) where published_at is null;

create table notifications (
  id bigint generated always as identity primary key,
  -- id của outbox: consumer nhận lại cùng message thì bỏ qua.
  event_id bigint not null unique,
  order_id uuid not null,
  channel text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
