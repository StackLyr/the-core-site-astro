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
