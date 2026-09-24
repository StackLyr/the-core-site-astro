CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  class_name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 20 AND 180),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 40),
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents BETWEEN 0 AND 1000000),
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS sessions_starts_at ON sessions(starts_at);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL CHECK (status IN ('requested', 'pending_payment', 'confirmed', 'cancelled', 'no_show', 'payment_failed', 'review')),
  amount_cents INTEGER,
  payment_reference TEXT UNIQUE,
  wompi_transaction_id TEXT UNIQUE,
  hold_expires_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS bookings_session_status ON bookings(session_id, status);
CREATE INDEX IF NOT EXISTS bookings_client ON bookings(client_id);

CREATE TABLE IF NOT EXISTS booking_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  event_type TEXT NOT NULL,
  detail TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS booking_events_booking ON booking_events(booking_id);

CREATE TABLE IF NOT EXISTS membership_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  class_credits INTEGER NOT NULL CHECK (class_credits BETWEEN 1 AND 100),
  validity_days INTEGER NOT NULL CHECK (validity_days BETWEEN 1 AND 365),
  price_cents INTEGER NOT NULL CHECK (price_cents BETWEEN 1 AND 1000000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES membership_plans(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'active', 'expired', 'cancelled', 'payment_failed', 'review')),
  class_credits INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL,
  payment_reference TEXT NOT NULL UNIQUE,
  wompi_transaction_id TEXT UNIQUE,
  purchased_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS memberships_client ON memberships(client_id, status);

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS email_outbox_status ON email_outbox(status, created_at);
