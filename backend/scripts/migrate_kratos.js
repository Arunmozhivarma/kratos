const pool = require('../db');

const sql = `
BEGIN;

ALTER TABLE kratos.devices RENAME TO device;

ALTER TABLE kratos.device RENAME COLUMN device_id TO id;
ALTER TABLE kratos.device RENAME COLUMN device_status TO status;
ALTER TABLE kratos.device RENAME COLUMN sensor_reading TO reading;

ALTER TABLE kratos.device 
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE kratos.device 
  ADD COLUMN IF NOT EXISTS state_start_time TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE kratos.device 
  ALTER COLUMN status TYPE TEXT USING (CASE WHEN status = true THEN 'ON' ELSE 'OFF' END);

ALTER TABLE kratos.device
  ALTER COLUMN id TYPE INTEGER USING id::integer,
  ALTER COLUMN lab_id TYPE INTEGER USING lab_id::integer,
  ALTER COLUMN reading TYPE DOUBLE PRECISION USING COALESCE(reading, 0)::double precision,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN reading SET NOT NULL,
  ALTER COLUMN reading SET DEFAULT 0,
  ALTER COLUMN last_updated_at SET NOT NULL,
  ALTER COLUMN state_start_time SET NOT NULL;

-- Remove the old updated_at column or rename it
ALTER TABLE kratos.device DROP COLUMN IF EXISTS updated_at;

CREATE TABLE IF NOT EXISTS kratos.lab_auditing (
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

CREATE TABLE IF NOT EXISTS kratos.energy_consumption (
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

ALTER TABLE kratos.device DROP CONSTRAINT IF EXISTS device_lab_id_id_key;
ALTER TABLE kratos.device ADD CONSTRAINT device_status_check CHECK (status IN ('ON', 'OFF'));
ALTER TABLE kratos.device ADD CONSTRAINT device_lab_id_id_key UNIQUE (lab_id, id);

CREATE INDEX IF NOT EXISTS idx_device_lab_id ON kratos.device (lab_id);
CREATE INDEX IF NOT EXISTS idx_device_lab_status ON kratos.device (lab_id, status);

COMMIT;
`;

async function run() {
  try {
    console.log("Running migration on kratos schema...");
    await pool.query(sql);
    console.log("Migration successful!");
  } catch(e) {
    console.error("Migration failed:", e);
    await pool.query("ROLLBACK;");
  } finally {
    pool.end();
  }
}

run();
