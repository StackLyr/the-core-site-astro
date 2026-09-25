INSERT INTO sessions (id, class_name, starts_at, duration_minutes, capacity, price_cents, state)
VALUES
  ('demo-session-base', 'Reformer Base', date('now', '+1 day') || 'T15:00:00.000Z', 50, 8, 2500, 'open'),
  ('demo-session-flow', 'Reformer Flow', date('now', '+2 day') || 'T22:30:00.000Z', 50, 8, 2800, 'open'),
  ('demo-session-athletic', 'Reformer Athletic', date('now', '+3 day') || 'T14:00:00.000Z', 55, 6, 3000, 'open'),
  ('demo-session-restore', 'Restore & Stretch', date('now', '+4 day') || 'T17:00:00.000Z', 45, 10, 2200, 'open')
ON CONFLICT(id) DO UPDATE SET
  class_name = excluded.class_name,
  starts_at = excluded.starts_at,
  duration_minutes = excluded.duration_minutes,
  capacity = excluded.capacity,
  price_cents = excluded.price_cents,
  state = excluded.state;

INSERT INTO membership_plans (id, name, description, class_credits, validity_days, price_cents, active)
VALUES
  ('demo-plan-4', 'Core 4', 'Cuatro clases para conocer el método y construir constancia.', 4, 30, 8800, 1),
  ('demo-plan-8', 'Core 8', 'Ocho clases para una práctica regular durante el mes.', 8, 30, 16000, 1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  class_credits = excluded.class_credits,
  validity_days = excluded.validity_days,
  price_cents = excluded.price_cents,
  active = excluded.active;
