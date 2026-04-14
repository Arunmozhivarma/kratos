BEGIN;

-- Rename the legacy devices table if the new snapshot table name does not exist yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'devices'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'device'
  ) THEN
    EXECUTE 'ALTER TABLE public.devices RENAME TO device';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.device
  RENAME COLUMN device_id TO id;

ALTER TABLE IF EXISTS public.device
  RENAME COLUMN device_status TO status;

ALTER TABLE IF EXISTS public.device
  RENAME COLUMN sensor_reading TO reading;

ALTER TABLE IF EXISTS public.device
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS state_start_time TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.device
SET status = CASE
  WHEN status::text IN ('true', 't', '1', 'ON') THEN 'ON'
  ELSE 'OFF'
END
WHERE status IS NOT NULL;

ALTER TABLE IF EXISTS public.device
  ALTER COLUMN id TYPE INTEGER USING id::integer,
  ALTER COLUMN lab_id TYPE INTEGER USING lab_id::integer,
  ALTER COLUMN status TYPE TEXT USING status::text,
  ALTER COLUMN reading TYPE DOUBLE PRECISION USING COALESCE(reading, 0)::double precision,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN reading SET NOT NULL,
  ALTER COLUMN reading SET DEFAULT 0,
  ALTER COLUMN last_updated_at SET NOT NULL,
  ALTER COLUMN state_start_time SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_status_check'
  ) THEN
    ALTER TABLE public.device
      ADD CONSTRAINT device_status_check CHECK (status IN ('ON', 'OFF'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_lab_id_id_key'
  ) THEN
    ALTER TABLE public.device
      ADD CONSTRAINT device_lab_id_id_key UNIQUE (lab_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.lab_auditing (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  lab_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ON', 'OFF')),
  reading DOUBLE PRECISION NOT NULL DEFAULT 0,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time >= start_time)
);

CREATE TABLE IF NOT EXISTS public.energy_consumption (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  lab_id INTEGER NOT NULL,
  reading DOUBLE PRECISION NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_hours DOUBLE PRECISION NOT NULL,
  energy_wh DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (duration_hours > 0),
  CHECK (energy_wh > 0)
);

CREATE INDEX IF NOT EXISTS idx_device_lab_id ON public.device (lab_id);
CREATE INDEX IF NOT EXISTS idx_device_lab_status ON public.device (lab_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_auditing_lab_recorded_at ON public.lab_auditing (lab_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_auditing_device_time ON public.lab_auditing (device_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_energy_consumption_lab_created_at ON public.energy_consumption (lab_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_energy_consumption_device_created_at ON public.energy_consumption (device_id, created_at DESC);

COMMIT;
