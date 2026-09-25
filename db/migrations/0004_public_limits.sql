CREATE INDEX IF NOT EXISTS admin_login_failures_time ON admin_login_failures(failed_at);

CREATE TABLE IF NOT EXISTS public_request_limits (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS public_request_limits_lookup ON public_request_limits(scope, ip_hash, created_at);
CREATE INDEX IF NOT EXISTS public_request_limits_time ON public_request_limits(created_at);
