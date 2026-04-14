CREATE TABLE IF NOT EXISTS public.device_runtime_sessions (
  lab_id INTEGER NOT NULL,
  device_id INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  current_amps DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lab_id, device_id)
);
