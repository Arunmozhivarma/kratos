const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const axios = require("axios");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const pool = require("./db");
const ZoneAutomationService = require("./services/zoneAutomationService");
require("dotenv").config();

const app = express();
const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");
const OCCUPANCY_DIR = path.join(__dirname, "../occupancy_detection");
const ENABLE_DB_TO_ESP32_SYNC = process.env.ENABLE_DB_TO_ESP32_SYNC === "true";
const ENABLE_ESP32 = process.env.ENABLE_ESP32 !== "false";
const LINE_VOLTAGE_VOLTS = Number.parseFloat(process.env.LINE_VOLTAGE_VOLTS || "230");

// Store previous device states to detect changes
let previousDeviceStates = new Map();

// ESP32 IP Configuration
const ESP32_IP = "http://192.168.0.114"; 

// Function to trigger ESP32
async function triggerESP32(deviceId, state) {
  if (!ENABLE_ESP32) {
    return; // Skip ESP32 calls if not enabled
  }

  try {
    const action = state ? "on" : "off";
    const endpoint = `${ESP32_IP}/${action}${deviceId}`;
    console.log(`Sending ESP32 command: ${endpoint}`);
    await axios.get(endpoint, { timeout: 5000 });
  } catch (err) {
    console.error(`ESP32 error:`, err.message);
  }
}

// Poll DB
async function pollDatabaseForChanges() {
  if (!ENABLE_ESP32) {
    return; // Skip polling if ESP32 is not enabled
  }

  try {
    const result = await pool.query(
      `SELECT device_id, device_status FROM ${DB_SCHEMA}.devices`
    );

    for (const device of result.rows) {
      const prev = previousDeviceStates.get(device.device_id);

      if (prev !== undefined && prev !== device.device_status) {
        await triggerESP32(device.device_id, device.device_status);
      }

      previousDeviceStates.set(device.device_id, device.device_status);
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

if (ENABLE_DB_TO_ESP32_SYNC) {
  console.log("DB->ESP32 polling is enabled");
  setInterval(pollDatabaseForChanges, 2000);
} else {
  console.log("DB->ESP32 polling is disabled (zone-detection controls ESP32 directly)");
}

// Init states
async function initializeDeviceStates() {
  if (!ENABLE_ESP32) {
    return; // Skip ESP32 state initialization if not enabled
  }

  try {
    const result = await pool.query(
      `SELECT device_id, device_status FROM ${DB_SCHEMA}.devices`
    );

    result.rows.forEach(d =>
      previousDeviceStates.set(d.device_id, d.device_status)
    );
  } catch (err) {
    console.error(err);
  }
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("KRATOS backend is running");
});

function resolvePythonExecutable() {
  const isWindows = os.platform() === "win32";
  const venvPython = isWindows
    ? path.join(OCCUPANCY_DIR, "venv/Scripts/python.exe")
    : path.join(OCCUPANCY_DIR, "venv/bin/python");

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  return isWindows ? "python" : "python3";
}

function parseCameraJson(output) {
  const raw = (output || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    // OpenCV logs can pollute stdout; recover by parsing the last JSON-like line.
    const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (line.startsWith("{") && line.endsWith("}")) {
        try {
          return JSON.parse(line);
        } catch {
          // keep scanning
        }
      }
    }
  }

  return null;
}

const ENERGY_COST_PER_KWH = 0.2;

function parseNumericLabId(labId) {
  const parsed = Number.parseInt(labId, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function roundNumber(value, digits = 2) {
  return Number.parseFloat(Number(value || 0).toFixed(digits));
}

function formatEnergyDisplay(kwh) {
  const numericKwh = Number(kwh || 0);

  if (numericKwh > 0 && numericKwh < 0.01) {
    return `${roundNumber(numericKwh * 1000, 3)} Wh`;
  }

  return `${roundNumber(numericKwh, 3)} kWh`;
}

function formatSignedPercentChange(currentValue, previousValue) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);

  if (previous === 0) {
    if (current === 0) {
      return "0.0%";
    }

    return "+100.0%";
  }

  const delta = ((current - previous) / previous) * 100;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta.toFixed(1)}%`;
}

async function getDashboardSnapshotByLabId(labId) {
  const result = await pool.query(
    `SELECT
       l.lab_id,
       l.name AS lab_name,
       COALESCE(device_stats.current_power_watts, 0) AS current_power_watts,
       COALESCE(today_energy.energy_today_kwh, 0) AS energy_today_kwh,
       COALESCE(device_stats.active_devices, 0) AS active_devices,
       COALESCE(dashboard_meta.last_updated, today_energy.last_history_at) AS last_updated
     FROM ${DB_SCHEMA}.labs l
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(COALESCE(d.sensor_reading, 0) * $2), 0) AS current_power_watts,
         COUNT(*) FILTER (WHERE d.device_status IS TRUE) AS active_devices
       FROM ${DB_SCHEMA}.devices d
       WHERE d.lab_id::integer = l.lab_id
     ) AS device_stats ON true
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(history_energy.energy_today_kwh, 0) + COALESCE(active_sessions.active_energy_today_kwh, 0) AS energy_today_kwh,
         GREATEST(history_energy.last_history_at, active_sessions.last_session_at) AS last_history_at
       FROM (
         SELECT
           COALESCE(SUM(ec.energy_kwh), 0) AS energy_today_kwh,
           MAX(ec.created_at) AS last_history_at
         FROM ${DB_SCHEMA}.energy_consumption ec
         WHERE ec.lab_id = l.lab_id
           AND ec.date = CURRENT_DATE
       ) AS history_energy
       CROSS JOIN (
         SELECT
           COALESCE(SUM(
             CASE
               WHEN drs.started_at >= date_trunc('day', NOW())
                 THEN (($2 * drs.current_amps) * (EXTRACT(EPOCH FROM (NOW() - drs.started_at)) / 3600.0)) / 1000.0
               ELSE (($2 * drs.current_amps) * (EXTRACT(EPOCH FROM (NOW() - date_trunc('day', NOW()))) / 3600.0)) / 1000.0
             END
           ), 0) AS active_energy_today_kwh,
           MAX(drs.updated_at) AS last_session_at
         FROM ${DB_SCHEMA}.device_runtime_sessions drs
         WHERE drs.lab_id = l.lab_id
       ) AS active_sessions
     ) AS today_energy ON true
     LEFT JOIN ${DB_SCHEMA}.lab_dashboard dashboard_meta
       ON dashboard_meta.lab_id = l.lab_id
     WHERE l.lab_id = $1
     LIMIT 1`,
    [labId, LINE_VOLTAGE_VOLTS]
  );

  return result.rows[0] || null;
}

async function syncLabDashboard(client, labId, fallbackTimestamp = null) {
  const dashboardResult = await client.query(
    `WITH device_stats AS (
       SELECT
         COALESCE(SUM(COALESCE(sensor_reading, 0) * $3), 0) AS current_power_watts,
         COUNT(*) FILTER (WHERE device_status IS TRUE) AS active_devices
       FROM ${DB_SCHEMA}.devices
       WHERE lab_id::integer = $1
     ),
     today_energy AS (
       SELECT
         COALESCE(history_energy.energy_today_kwh, 0) + COALESCE(active_sessions.active_energy_today_kwh, 0) AS energy_today_kwh,
         GREATEST(history_energy.last_history_at, active_sessions.last_session_at) AS last_history_at
       FROM (
         SELECT
           COALESCE(SUM(energy_kwh), 0) AS energy_today_kwh,
           MAX(created_at) AS last_history_at
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND date = CURRENT_DATE
       ) AS history_energy
       CROSS JOIN (
         SELECT
           COALESCE(SUM(
             CASE
               WHEN started_at >= date_trunc('day', NOW())
                 THEN (($3 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600.0)) / 1000.0
               ELSE (($3 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - date_trunc('day', NOW()))) / 3600.0)) / 1000.0
             END
           ), 0) AS active_energy_today_kwh,
           MAX(updated_at) AS last_session_at
         FROM ${DB_SCHEMA}.device_runtime_sessions
         WHERE lab_id = $1
       ) AS active_sessions
     )
     INSERT INTO ${DB_SCHEMA}.lab_dashboard (
       lab_id,
       current_power_watts,
       energy_today_kwh,
       active_devices,
       last_updated
     )
     SELECT
       $1,
       device_stats.current_power_watts,
       today_energy.energy_today_kwh,
       device_stats.active_devices,
       COALESCE($2::timestamp, today_energy.last_history_at, NOW())
     FROM device_stats, today_energy
     ON CONFLICT (lab_id) DO UPDATE
     SET current_power_watts = EXCLUDED.current_power_watts,
         energy_today_kwh = EXCLUDED.energy_today_kwh,
         active_devices = EXCLUDED.active_devices,
         last_updated = EXCLUDED.last_updated
     RETURNING *`,
    [labId, fallbackTimestamp, LINE_VOLTAGE_VOLTS]
  );

  return dashboardResult.rows[0] || null;
}

async function ensureDeviceRuntimeSessionsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.device_runtime_sessions (
       lab_id INTEGER NOT NULL,
       device_id INTEGER NOT NULL,
       started_at TIMESTAMPTZ NOT NULL,
       current_amps DOUBLE PRECISION NOT NULL,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (lab_id, device_id)
     )`
  );
}

async function initializeRuntimeSessionsFromLiveDevices() {
  await pool.query(
    `INSERT INTO ${DB_SCHEMA}.device_runtime_sessions (
       lab_id,
       device_id,
       started_at,
       current_amps,
       updated_at
     )
     SELECT
       lab_id::integer,
       device_id,
       NOW(),
       COALESCE(sensor_reading, 0),
       NOW()
     FROM ${DB_SCHEMA}.devices
     WHERE device_status IS TRUE
     ON CONFLICT (lab_id, device_id) DO UPDATE
     SET current_amps = EXCLUDED.current_amps,
         updated_at = EXCLUDED.updated_at`
  );
}

// ================= CAMERA DISCOVERY =================

app.get("/api/cameras", async (req, res) => {
  try {
    const isWindows = os.platform() === "win32";
    const candidates = [resolvePythonExecutable(), isWindows ? "python" : "python3"];

    const runDiscovery = (pythonExecutable) => new Promise((resolve) => {
      const cameraProcess = spawn(pythonExecutable, ["list_cameras.py"], {
        cwd: OCCUPANCY_DIR,
        stdio: "pipe"
      });

      let output = "";
      let errorOutput = "";

      cameraProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      cameraProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      cameraProcess.on("close", (code) => {
        resolve({
          ok: code === 0,
          pythonExecutable,
          output,
          errorOutput,
        });
      });

      cameraProcess.on("error", (error) => {
        resolve({
          ok: false,
          pythonExecutable,
          output,
          errorOutput: `${errorOutput}\n${error.message}`.trim(),
        });
      });
    });

    let lastFailure = null;
    for (const pythonExecutable of [...new Set(candidates)]) {
      const result = await runDiscovery(pythonExecutable);
      if (!result.ok) {
        lastFailure = result;
        continue;
      }

      const parsed = parseCameraJson(result.output);
      if (!parsed) {
        lastFailure = result;
        continue;
      }

      const cameras = Array.isArray(parsed.cameras) ? parsed.cameras : [];
      const preferredIndex = Number.isInteger(parsed.preferred_index)
        ? parsed.preferred_index
        : (cameras[0]?.index ?? 0);

      return res.json({
        cameras,
        preferredIndex
      });
    }

    console.error("Camera discovery failed:", lastFailure?.errorOutput || "Unknown error");
    return res.status(500).json({ message: "Failed to detect cameras" });
  } catch (error) {
    console.error("Error getting cameras:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= BASIC APIs =================

app.get("/api/departments", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT department_id, name FROM ${DB_SCHEMA}.departments ORDER BY name`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/labs/:departmentId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lab_id, name FROM ${DB_SCHEMA}.labs
       WHERE department_id=$1 AND is_active=true`,
      [req.params.departmentId]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/labs", async (req, res) => {
  try {
    const { name, department_id } = req.body;

    if (!name || !department_id) {
      return res.status(400).json({ message: "name and department_id are required" });
    }

    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.labs (name, department_id, is_active)
       VALUES ($1, $2, true)
       RETURNING lab_id, name, department_id, is_active`,
      [name, department_id]
    );

    const newLab = result.rows[0];

    // Automatically create zones for this new lab
    try {
      await ZoneAutomationService.createZonesForLab(newLab.lab_id);
      console.log(`Automatically created zones for new lab: ${newLab.lab_id}`);
    } catch (zoneError) {
      console.error("Error creating zones for new lab:", zoneError);
      // Don't fail the lab creation if zone creation fails
    }

    res.status(201).json({
      message: "Lab created successfully",
      lab: newLab
    });
  } catch (error) {
    console.error("Error creating lab:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/labs/:labId", async (req, res) => {
  const client = await pool.connect();

  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    await client.query("BEGIN");

    const existingLabResult = await client.query(
      `SELECT lab_id, name
       FROM ${DB_SCHEMA}.labs
       WHERE lab_id = $1
       FOR UPDATE`,
      [parsedLabId]
    );

    if (existingLabResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Lab not found" });
    }

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.zones
       WHERE lab_id = $1`,
      [parsedLabId]
    );

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.devices
       WHERE lab_id = $1::text`,
      [parsedLabId]
    );

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1`,
      [parsedLabId]
    );

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.lab_audit_values
       WHERE lab_id = $1`,
      [parsedLabId]
    );

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.lab_dashboard
       WHERE lab_id = $1`,
      [parsedLabId]
    );

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.device_runtime_sessions
       WHERE lab_id = $1`,
      [parsedLabId]
    );

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.user_lab_access
       WHERE lab_id = $1`,
      [parsedLabId]
    );

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.labs
       WHERE lab_id = $1`,
      [parsedLabId]
    );

    await client.query("COMMIT");

    res.json({
      message: "Lab deleted successfully",
      deleted_lab_id: parsedLabId,
      deleted_lab_name: existingLabResult.rows[0].name
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed while deleting lab:", rollbackError);
    }
    console.error("Error deleting lab:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

// ================= DASHBOARD APIs =================

app.get("/api/dashboard/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Handle test-lab specifically
    if (labId === 'test-lab') {
      return res.json({
        lab_id: 'test-lab',
        lab_name: 'Test Lab (Simulation)',
        current_power_watts: 0,
        energy_today_kwh: 0,
        active_devices: 0,
        last_updated: new Date().toISOString()
      });
    }

    const snapshot = await getDashboardSnapshotByLabId(labId);

    if (!snapshot) {
      return res.status(404).json({ message: "Lab not found" });
    }

    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching dashboard values by lab ID:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const { departmentId, labName } = req.query;

    if (!departmentId || !labName) {
      return res.status(400).json({
        message: "departmentId and labName query params are required",
      });
    }

    const result = await pool.query(
      `SELECT lab_id
       FROM ${DB_SCHEMA}.labs
       WHERE department_id = $1
         AND name = $2
       LIMIT 1`,
      [departmentId, labName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lab not found" });
    }

    const snapshot = await getDashboardSnapshotByLabId(result.rows[0].lab_id);
    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching dashboard values by lab name:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= AUTH =================

app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, department_id, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.users
       (username,email,department_id,password_hash)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [username, email, department_id, hash]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ message: "Signup error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { identifier, department_id, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM ${DB_SCHEMA}.users
       WHERE (username=$1 OR email=$1)
       AND department_id=$2`,
      [identifier, department_id]
    );

    if (!result.rows.length) return res.status(401).json({ message: "Invalid" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) return res.status(401).json({ message: "Invalid" });

    res.json(user);
  } catch {
    res.status(500).json({ message: "Login error" });
  }
});

app.post("/api/change-password", async (req, res) => {
  try {
    const { identifier, department_id, currentPassword, newPassword } = req.body;

    if (!identifier || !department_id || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "identifier, department_id, currentPassword, and newPassword are required" });
    }

    const result = await pool.query(
      `SELECT * FROM ${DB_SCHEMA}.users
       WHERE (username=$1 OR email=$1)
       AND department_id=$2`,
      [identifier, department_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);

    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE ${DB_SCHEMA}.users
       SET password_hash=$1
       WHERE (username=$2 OR email=$2)
       AND department_id=$3`,
      [newHash, identifier, department_id]
    );

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Change password error" });
  }
});

// ================= DEVICES =================

app.post("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.devices (device_id, device_status, lab_id)
       VALUES ($1,false,$2)
       ON CONFLICT (lab_id, device_id) DO NOTHING RETURNING *`,
      [req.body.device_id, req.body.lab_id]
    );

    if (!result.rows.length) {
      return res.status(409).json({ message: "Exists" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating device" });
  }
});

// ================= CAMERA & DETECTION APIs =================

let detectionProcess = null;
let currentDetectionStatus = {};

app.get("/api/zones", async (req, res) => {
  try {
    const { labId } = req.query;

    if (!labId) {
      return res.status(400).json({ message: "labId is required" });
    }

    if (labId === 'test-lab') {
      return res.json({});
    }

    // Get all zones for this lab with their configuration boxes
    const result = await pool.query(
      `SELECT device_id, zone_name, zone_coordinates 
       FROM ${DB_SCHEMA}.zones 
       WHERE lab_id = $1 
       ORDER BY zone_name, device_id`,
      [labId]
    );

    if (result.rows.length > 0) {
      // Convert database result to zone format
      const zones = {};
      result.rows.forEach(row => {
        const zoneName = row.zone_name || 'configBox1'; // Default if null
        const zoneKey = `${zoneName}_${row.device_id}`;
        // zone_coordinates is already an array, no need to parse
        zones[zoneKey] = row.zone_coordinates;
      });
      res.json(zones);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error("Error reading zones:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/zones", async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { labId, zones } = req.body;

    if (!labId) {
      return res.status(400).json({ message: "labId is required" });
    }

    if (labId === 'test-lab') {
      return res.json({ message: "Test lab zones are not persisted", labId, zonesCount: 0, zones: [] });
    }

    const zoneEntries = Object.entries(zones || {});
    const configuredDeviceIds = [...new Set(
      zoneEntries
        .map(([zoneKey]) => {
          const parts = zoneKey.split('_');
          return Number.parseInt(parts[parts.length - 1], 10);
        })
        .filter((deviceId) => Number.isInteger(deviceId))
    )];

    await client.query('BEGIN');
    transactionStarted = true;

    // Clear existing zones for this lab
    await client.query(
      `DELETE FROM ${DB_SCHEMA}.zones WHERE lab_id = $1`,
      [labId]
    );

    // Insert new zones with unique configuration boxes
    for (const [zoneKey, coordinates] of zoneEntries) {
      // Parse zoneKey to extract zone_name and device_id
      // Format: "configBox1_device1" or similar
      const parts = zoneKey.split('_');
      const device_id = Number.parseInt(parts[parts.length - 1], 10); // Last part is the physical device id
      const zone_name = parts.slice(0, -1).join('_'); // Everything except last part

      if (!Number.isInteger(device_id)) {
        throw new Error(`Invalid device id in zone key: ${zoneKey}`);
      }

      await client.query(
        `INSERT INTO ${DB_SCHEMA}.zones (lab_id, device_id, zone_name, zone_coordinates)
         VALUES ($1, $2, $3, $4)`,
        [labId, device_id, zone_name, JSON.stringify(coordinates)]
      );
    }

    await client.query(
      `DELETE FROM ${DB_SCHEMA}.devices
       WHERE lab_id = $1
         AND NOT (device_id = ANY($2::int[]))`,
      [labId, configuredDeviceIds]
    );

    for (const deviceId of configuredDeviceIds) {
      await client.query(
        `INSERT INTO ${DB_SCHEMA}.devices (device_id, device_status, lab_id)
         VALUES ($1, false, $2)
         ON CONFLICT (lab_id, device_id)
         DO UPDATE SET lab_id = EXCLUDED.lab_id`,
        [deviceId, labId]
      );
    }

    await client.query('COMMIT');

    // Also save to file for main.py compatibility
    const zonesPath = path.join(__dirname, '../occupancy_detection/zones.json');
    fs.writeFileSync(zonesPath, JSON.stringify(zones, null, 2));

    res.json({
      message: "Zones saved successfully",
      labId: labId,
      zonesCount: Object.keys(zones).length,
      zones: Object.keys(zones)
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    console.error("Error saving zones:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

app.post("/api/start-detection", async (req, res) => {
  try {
    const { labId, zones, cameraIndex } = req.body;
    const parsedCameraIndex = Number.parseInt(cameraIndex, 10);
    const selectedCameraIndex = Number.isNaN(parsedCameraIndex) ? 0 : parsedCameraIndex;

    if (detectionProcess) {
      return res.status(400).json({ message: "Detection is already running" });
    }

    console.log(`Starting detection for lab ${labId} with camera ${selectedCameraIndex} and zones:`, zones);

    // Start the main.py detection script supporting cross-platform OS paths
    const pythonExecutable = resolvePythonExecutable();
      
    detectionProcess = spawn(pythonExecutable, ["main.py", labId.toString(), selectedCameraIndex.toString()], {
      cwd: OCCUPANCY_DIR,
      stdio: "pipe"
    });

    let output = '';
    let errorOutput = '';

    detectionProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Detection output:', data.toString().trim());

      // Parse detection status from output
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.includes('Updated')) {
          // Parse status updates like "Updated configBox1_1 to ON"
          const match = line.match(/Updated (.+) to (ON|OFF)/);
          if (match) {
            const zoneKey = match[1];
            const status = match[2] === 'ON';
            // Set status for this specific zoneKey
            currentDetectionStatus[zoneKey] = status;
          }
        }
      });
    });

    detectionProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Detection error:', data.toString().trim());
    });

    detectionProcess.on('close', (code) => {
      console.log(`Detection process exited with code ${code}`);
      detectionProcess = null;
      currentDetectionStatus = {};
    });

    detectionProcess.on('error', (error) => {
      console.error('Failed to start detection process:', error);
      detectionProcess = null;
    });

    res.json({
      message: "Detection started successfully",
      labId: labId,
      cameraIndex: selectedCameraIndex,
      zones: Object.keys(zones)
    });

  } catch (error) {
    console.error("Error starting detection:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/stop-detection", async (req, res) => {
  try {
    if (detectionProcess) {
      detectionProcess.kill('SIGTERM');
      detectionProcess = null;
      currentDetectionStatus = {};
      res.json({ message: "Detection stopped successfully" });
    } else {
      res.json({ message: "Detection is not running" });
    }
  } catch (error) {
    console.error("Error stopping detection:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/detection-status", async (req, res) => {
  try {
    const { labId } = req.query;

    const result = await pool.query(
      `SELECT device_id, device_status FROM ${DB_SCHEMA}.devices WHERE lab_id = $1`,
      [labId]
    );

    const status = {};

    result.rows.forEach(row => {
      const zoneKey = `configBox1_${row.device_id}`; // match frontend
      status[zoneKey] = row.device_status;
    });

    res.json(status);

  } catch (error) {
    console.error("Error getting detection status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ZONE AUTOMATION APIs =================

app.post("/api/labs/:labId/configure-zones", async (req, res) => {
  try {
    const { labId } = req.params;

    console.log(`Starting zone configuration for lab ${labId}`);

    // Use the zone automation service to create zones
    const result = await ZoneAutomationService.createZonesForLab(labId);

    res.json({
      message: "Zone configuration completed successfully",
      labId: labId,
      zonesCreated: result.zonesCreated,
      totalDevices: result.totalDevices
    });

  } catch (error) {
    console.error("Error in zone configuration:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/labs/:labId/bulk-assign-devices", async (req, res) => {
  try {
    const { labId } = req.params;
    const { deviceIds } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ message: "deviceIds must be a non-empty array" });
    }

    const result = await ZoneAutomationService.bulkAssignDevicesToLab(labId, deviceIds);

    res.json({
      message: "Devices assigned to lab successfully",
      labId: labId,
      totalDevices: result.totalDevices,
      zonesCreated: result.zonesCreated,
      results: result.results
    });

  } catch (error) {
    console.error("Error bulk assigning devices to lab:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/setup-zones-for-all-labs", async (req, res) => {
  try {
    const result = await ZoneAutomationService.createZonesForAllExistingLabs();

    res.json({
      message: "Zone setup completed for all labs",
      totalLabs: result.totalLabs,
      results: result.results
    });

  } catch (error) {
    console.error("Error setting up zones for all labs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/labs/:labId/zone-integrity", async (req, res) => {
  try {
    const { labId } = req.params;
    const result = await ZoneAutomationService.validateZoneIntegrity(labId);

    res.json(result);

  } catch (error) {
    console.error("Error validating zone integrity:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ENERGY =================

app.get("/api/energy-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);
    if (labId === 'test-lab') {
      // Return mock energy consumption data for test lab
      const mockData = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        mockData.push({
          date: date.toISOString().split('T')[0],
          total: (Math.random() * 10 + 5).toFixed(2) // Random energy between 5-15 kWh
        });
      }
      return res.json(mockData);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const result = await pool.query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS date
       ),
       history_by_day AS (
         SELECT date, COALESCE(SUM(energy_kwh), 0) AS total
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND date >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY date
       ),
       active_today AS (
         SELECT
           CURRENT_DATE AS date,
           COALESCE(SUM(
             CASE
               WHEN started_at >= date_trunc('day', NOW())
                 THEN (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600.0)) / 1000.0
               ELSE (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - date_trunc('day', NOW()))) / 3600.0)) / 1000.0
             END
           ), 0) AS total
         FROM ${DB_SCHEMA}.device_runtime_sessions
         WHERE lab_id = $1
       )
       SELECT
         days.date,
         ROUND(COALESCE(SUM(combined.total), 0)::numeric, 9) AS total
       FROM days
       LEFT JOIN (
         SELECT date, total FROM history_by_day
         UNION ALL
         SELECT date, total FROM active_today
       ) AS combined ON combined.date = days.date
       GROUP BY days.date
       ORDER BY days.date`,
      [parsedLabId, LINE_VOLTAGE_VOLTS]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching energy consumption:", error);
    res.status(500).json({ message: "Error" });
  }
});

// ================= DEVICE UPDATE =================

app.post("/api/esp32/control", async (req, res) => {
  try {
    const { device_id, status } = req.body;
    const resolvedDeviceId = device_id;

    if (!resolvedDeviceId || status === undefined) {
      return res.status(400).json({
        message: "device_id and status required"
      });
    }

    const normalizedDeviceId = String(resolvedDeviceId);
    if (!["1", "2"].includes(normalizedDeviceId)) {
      return res.status(400).json({
        message: "device_id must be 1 or 2 in simulation mode"
      });
    }

    const deviceStatus = status === "ON" || status === true;
    await triggerESP32(normalizedDeviceId, deviceStatus);

    res.status(200).json({
      message: "ESP32 command sent",
      device_id: normalizedDeviceId,
      status: deviceStatus
    });
  } catch (error) {
    console.error("Error sending ESP32 command:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/devices/update", async (req, res) => {
  const client = await pool.connect();

  try {
    const { device_id, lab_id, status, current } = req.body;

    if (!device_id || !lab_id || status === undefined || current === undefined) {
      return res.status(400).json({
        message: "device_id, lab_id, status, current required"
      });
    }

    console.log("Received device update:", { device_id, lab_id, status, current });

    const parsedLabId = parseNumericLabId(lab_id);
    const parsedDeviceId = Number.parseInt(device_id, 10);
    const parsedCurrent = Number.parseFloat(current);

    if (parsedLabId === null || !Number.isInteger(parsedDeviceId) || Number.isNaN(parsedCurrent)) {
      return res.status(400).json({
        message: "device_id, lab_id and current must be numeric"
      });
    }

    const deviceStatus = status === "ON" || status === true;
    const eventTimestamp = new Date();
    const eventDate = eventTimestamp.toISOString().slice(0, 10);
    const eventHour = eventTimestamp.getHours();

    await client.query("BEGIN");

    const existingDeviceResult = await client.query(
      `SELECT device_id, lab_id, device_status, sensor_reading
       FROM ${DB_SCHEMA}.devices
       WHERE device_id = $1
         AND lab_id = $2
       FOR UPDATE`,
      [parsedDeviceId, String(parsedLabId)]
    );

    if (existingDeviceResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Device not found for this lab"
      });
    }

    const existingDevice = existingDeviceResult.rows[0];
    const activeSessionResult = await client.query(
      `SELECT started_at, current_amps, updated_at
       FROM ${DB_SCHEMA}.device_runtime_sessions
       WHERE lab_id = $1
         AND device_id = $2
       FOR UPDATE`,
      [parsedLabId, parsedDeviceId]
    );

    if (deviceStatus) {
      if (activeSessionResult.rowCount === 0) {
        await client.query(
          `INSERT INTO ${DB_SCHEMA}.device_runtime_sessions (
             lab_id,
             device_id,
             started_at,
             current_amps,
             updated_at
           )
           VALUES ($1, $2, $3, $4, $3)`,
          [parsedLabId, parsedDeviceId, eventTimestamp, parsedCurrent]
        );
      } else {
        await client.query(
          `UPDATE ${DB_SCHEMA}.device_runtime_sessions
           SET current_amps = $3,
               updated_at = $4
           WHERE lab_id = $1
             AND device_id = $2`,
          [parsedLabId, parsedDeviceId, parsedCurrent, eventTimestamp]
        );
      }
    } else if (activeSessionResult.rowCount > 0) {
      const activeSession = activeSessionResult.rows[0];
      const sessionStart = new Date(activeSession.started_at);
      const currentAmps = Number.parseFloat(activeSession.current_amps);
      const durationHours = Math.max((eventTimestamp.getTime() - sessionStart.getTime()) / 3600000, 0);
      const sessionEnergyKwh = roundNumber((LINE_VOLTAGE_VOLTS * currentAmps * durationHours) / 1000, 6);
      const uptimeSnapshot = Math.min((durationHours / 24) * 100, 100);

      if (sessionEnergyKwh > 0) {
        await client.query(
          `INSERT INTO ${DB_SCHEMA}.energy_consumption (
             lab_id,
             date,
             hour,
             energy_kwh,
             created_at
           )
           VALUES ($1, $2::date, $3, $4, $5)`,
          [parsedLabId, eventDate, eventHour, sessionEnergyKwh, eventTimestamp]
        );

        await client.query(
          `INSERT INTO ${DB_SCHEMA}.lab_audit_values (
             lab_id,
             audit_date,
             energy_kwh,
             occupancy_avg_pct,
             device_uptime_pct,
             temperature_avg_c,
             anomalies_count,
             audit_score,
             created_at,
             updated_at
           )
           VALUES ($1, $2::date, $3, 0, $4, 0, 0, 100, $5, $5)
           ON CONFLICT (lab_id, audit_date) DO UPDATE
           SET energy_kwh = ${DB_SCHEMA}.lab_audit_values.energy_kwh + EXCLUDED.energy_kwh,
               device_uptime_pct = ROUND((COALESCE(${DB_SCHEMA}.lab_audit_values.device_uptime_pct, 0) + EXCLUDED.device_uptime_pct) / 2.0, 2),
               updated_at = EXCLUDED.updated_at`,
          [parsedLabId, eventDate, sessionEnergyKwh, uptimeSnapshot, eventTimestamp]
        );
      }

      await client.query(
        `DELETE FROM ${DB_SCHEMA}.device_runtime_sessions
         WHERE lab_id = $1
           AND device_id = $2`,
        [parsedLabId, parsedDeviceId]
      );
    }

    await client.query(
      `UPDATE ${DB_SCHEMA}.devices
       SET device_status = $1,
           sensor_reading = $2
       WHERE device_id = $3
         AND lab_id = $4`,
      [deviceStatus, parsedCurrent, parsedDeviceId, String(parsedLabId)]
    );

    const dashboardRow = await syncLabDashboard(client, parsedLabId, eventTimestamp);

    await client.query("COMMIT");

    res.status(200).json({
      message: "Updated successfully",
      session_tracking_mode: "on_off_duration",
      device: {
        device_id: parsedDeviceId,
        lab_id: parsedLabId,
        device_status: deviceStatus,
        sensor_reading: parsedCurrent
      },
      dashboard: dashboardRow,
      updated_at: eventTimestamp.toISOString()
    });

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
    console.error("Error updating device:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

// ================= ANALYTICS =================

app.get("/api/analytics-summary/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (labId === 'test-lab') {
      return res.json([
        { metric: 'Total Energy Today', value: '12.5 kWh', change: '+2.3%' },
        { metric: 'Active Devices', value: '3', change: '0%' },
        { metric: 'Peak Power', value: '450W', change: '-5.2%' },
        { metric: 'Average Temperature', value: '24°C', change: '+0.5°C' }
      ]);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const summaryResult = await pool.query(
      `WITH live_device_metrics AS (
         SELECT
           COUNT(*) FILTER (WHERE device_status IS TRUE) AS active_devices,
           COALESCE(SUM(COALESCE(sensor_reading, 0) * $2), 0) AS peak_power
         FROM ${DB_SCHEMA}.devices
         WHERE lab_id::integer = $1
       ),
       today_energy AS (
         SELECT COALESCE(history_energy.total, 0) + COALESCE(active_sessions.total, 0) AS total
         FROM (
           SELECT COALESCE(SUM(energy_kwh), 0) AS total
           FROM ${DB_SCHEMA}.energy_consumption
           WHERE lab_id = $1
             AND date = CURRENT_DATE
         ) AS history_energy
         CROSS JOIN (
           SELECT COALESCE(SUM(
             CASE
               WHEN started_at >= date_trunc('day', NOW())
                 THEN (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600.0)) / 1000.0
               ELSE (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - date_trunc('day', NOW()))) / 3600.0)) / 1000.0
             END
           ), 0) AS total
           FROM ${DB_SCHEMA}.device_runtime_sessions
           WHERE lab_id = $1
         ) AS active_sessions
       ),
       yesterday_energy AS (
         SELECT COALESCE(SUM(energy_kwh), 0) AS total
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND date = CURRENT_DATE - INTERVAL '1 day'
       ),
       latest_audit AS (
         SELECT temperature_avg_c
         FROM ${DB_SCHEMA}.lab_audit_values
         WHERE lab_id = $1
         ORDER BY audit_date DESC, updated_at DESC
         LIMIT 1
       ),
       previous_audit AS (
         SELECT temperature_avg_c
         FROM ${DB_SCHEMA}.lab_audit_values
         WHERE lab_id = $1
         ORDER BY audit_date DESC, updated_at DESC
         OFFSET 1
         LIMIT 1
       )
       SELECT
         live_device_metrics.active_devices,
         live_device_metrics.peak_power,
         today_energy.total AS energy_today,
         yesterday_energy.total AS energy_yesterday,
         latest_audit.temperature_avg_c AS average_temperature,
         previous_audit.temperature_avg_c AS previous_temperature
       FROM live_device_metrics, today_energy, yesterday_energy
       LEFT JOIN latest_audit ON true
       LEFT JOIN previous_audit ON true`,
      [parsedLabId, LINE_VOLTAGE_VOLTS]
    );

    const summary = summaryResult.rows[0] || {};
    const averageTemperature = Number(summary.average_temperature || 0);
    const previousTemperature = Number(summary.previous_temperature || 0);

    res.json([
      {
        metric: 'Total Energy Today',
        value: formatEnergyDisplay(summary.energy_today),
        change: formatSignedPercentChange(summary.energy_today, summary.energy_yesterday)
      },
      {
        metric: 'Active Devices',
        value: String(summary.active_devices || 0),
        change: `${summary.active_devices || 0} live`
      },
      {
        metric: 'Peak Power',
        value: `${roundNumber(summary.peak_power)}W`,
        change: 'Live device snapshot'
      },
      {
        metric: 'Average Temperature',
        value: `${roundNumber(averageTemperature)}°C`,
        change: `${averageTemperature >= previousTemperature ? "+" : ""}${(averageTemperature - previousTemperature).toFixed(1)}°C`
      }
    ]);
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/weekly-energy-cost/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (labId === 'test-lab') {
      const data = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        data.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          energy: (5 + i).toFixed(2),
          cost: (1 + i * 0.1).toFixed(2)
        });
      }
      return res.json(data);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const result = await pool.query(
      `WITH days AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
       ),
       energy_by_day AS (
         SELECT date AS day, COALESCE(SUM(energy_kwh), 0) AS energy
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND date >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY date
       ),
       active_today AS (
         SELECT
           CURRENT_DATE AS day,
           COALESCE(SUM(
             CASE
               WHEN started_at >= date_trunc('day', NOW())
                 THEN (($3 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600.0)) / 1000.0
               ELSE (($3 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - date_trunc('day', NOW()))) / 3600.0)) / 1000.0
             END
           ), 0) AS energy
         FROM ${DB_SCHEMA}.device_runtime_sessions
         WHERE lab_id = $1
       ),
       combined_energy AS (
         SELECT day, energy FROM energy_by_day
         UNION ALL
         SELECT day, energy FROM active_today
       ),
       total_energy_by_day AS (
         SELECT day, COALESCE(SUM(energy), 0) AS energy
         FROM combined_energy
         GROUP BY day
       )
       SELECT
         TO_CHAR(days.day, 'Dy') AS day,
         ROUND(COALESCE(total_energy_by_day.energy, 0)::numeric, 9) AS energy,
         ROUND((COALESCE(total_energy_by_day.energy, 0) * $2)::numeric, 9) AS cost
       FROM days
       LEFT JOIN total_energy_by_day ON total_energy_by_day.day = days.day
       ORDER BY days.day`,
      [parsedLabId, ENERGY_COST_PER_KWH, LINE_VOLTAGE_VOLTS]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching weekly energy cost:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/six-month-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (labId === 'test-lab') {
      const data = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      months.forEach((month, i) => {
        data.push({ month, consumption: (200 + i * 20).toFixed(2) });
      });
      return res.json(data);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const result = await pool.query(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
           date_trunc('month', CURRENT_DATE),
           INTERVAL '1 month'
         )::date AS month_start
       ),
       monthly_energy AS (
         SELECT
           date_trunc('month', date)::date AS month_start,
           COALESCE(SUM(energy_kwh), 0) AS consumption
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
         GROUP BY 1
       ),
       active_month AS (
         SELECT
           date_trunc('month', CURRENT_DATE)::date AS month_start,
           COALESCE(SUM((($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600.0)) / 1000.0), 0) AS consumption
         FROM ${DB_SCHEMA}.device_runtime_sessions
         WHERE lab_id = $1
       ),
       combined_monthly_energy AS (
         SELECT month_start, consumption FROM monthly_energy
         UNION ALL
         SELECT month_start, consumption FROM active_month
       ),
       total_monthly_energy AS (
         SELECT month_start, COALESCE(SUM(consumption), 0) AS consumption
         FROM combined_monthly_energy
         GROUP BY month_start
       )
       SELECT
         TO_CHAR(months.month_start, 'Mon') AS month,
         ROUND(COALESCE(total_monthly_energy.consumption, 0)::numeric, 9) AS consumption
       FROM months
       LEFT JOIN total_monthly_energy ON total_monthly_energy.month_start = months.month_start
       ORDER BY months.month_start`,
      [parsedLabId, LINE_VOLTAGE_VOLTS]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching six month consumption:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/top-energy-consumers/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (labId === 'test-lab') {
      return res.json([
        { device: 'Fan 1', consumption: '3.2 kWh', percentage: 25 },
        { device: 'Fan 2', consumption: '2.8 kWh', percentage: 22 },
        { device: 'Lighting', consumption: '2.1 kWh', percentage: 16 },
        { device: 'AC Unit', consumption: '1.9 kWh', percentage: 15 },
        { device: 'Equipment', consumption: '2.5 kWh', percentage: 22 }
      ]);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const result = await pool.query(
      `WITH device_totals AS (
         SELECT
           device_id,
           COALESCE(sensor_reading, 0) * $2 AS consumption_value
         FROM ${DB_SCHEMA}.devices
         WHERE lab_id::integer = $1
       ),
       totals AS (
         SELECT COALESCE(SUM(consumption_value), 0) AS total_consumption
         FROM device_totals
       )
       SELECT
         CONCAT('Device ', device_totals.device_id) AS device,
         ROUND(device_totals.consumption_value::numeric, 2) AS consumption_value,
         CASE
           WHEN totals.total_consumption = 0 THEN 0
           ELSE ROUND(((device_totals.consumption_value / totals.total_consumption) * 100)::numeric, 2)
         END AS percentage
       FROM device_totals, totals
       ORDER BY device_totals.consumption_value DESC, device_totals.device_id
       LIMIT 5`,
      [parsedLabId, LINE_VOLTAGE_VOLTS]
    );

    res.json(result.rows.map((row) => ({
      device: row.device,
      consumption: `${roundNumber(row.consumption_value)} W`,
      percentage: Number(row.percentage)
    })));
  } catch (error) {
    console.error("Error fetching top energy consumers:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/peak-usage-hours/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (labId === 'test-lab') {
      return res.json([
        { hour: '8:00', usage: 450 },
        { hour: '10:00', usage: 680 },
        { hour: '12:00', usage: 720 },
        { hour: '14:00', usage: 650 },
        { hour: '16:00', usage: 590 },
        { hour: '18:00', usage: 320 }
      ]);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const result = await pool.query(
      `WITH history_by_hour AS (
         SELECT hour, COALESCE(SUM(energy_kwh), 0) AS usage
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
         GROUP BY hour
       ),
       active_current_hour AS (
         SELECT
           EXTRACT(HOUR FROM NOW())::integer AS hour,
           COALESCE(SUM((($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - GREATEST(started_at, date_trunc('hour', NOW())))) / 3600.0)) / 1000.0), 0) AS usage
         FROM ${DB_SCHEMA}.device_runtime_sessions
         WHERE lab_id = $1
       ),
       combined_hourly_energy AS (
         SELECT hour, usage FROM history_by_hour
         UNION ALL
         SELECT hour, usage FROM active_current_hour
       )
       SELECT
         LPAD(hour::text, 2, '0') || ':00' AS hour,
         ROUND(COALESCE(SUM(usage), 0)::numeric, 9) AS usage
       FROM combined_hourly_energy
       GROUP BY hour
       ORDER BY usage DESC, hour
       LIMIT 6`,
      [parsedLabId, LINE_VOLTAGE_VOLTS]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching peak usage hours:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/energy-comparisons/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (labId === 'test-lab') {
      return res.json([
        { period: 'Today', consumption: 12.5, cost: 2.5, comparison: -2.3 },
        { period: 'Yesterday', consumption: 14.8, cost: 2.96, comparison: 0 },
        { period: 'Last Week', consumption: 89.2, cost: 17.84, comparison: 5.1 },
        { period: 'Last Month', consumption: 376.8, cost: 75.36, comparison: 8.7 }
      ]);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const metricsResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN date = CURRENT_DATE THEN energy_kwh ELSE 0 END), 0)
         + COALESCE((
           SELECT SUM(
             CASE
               WHEN started_at >= date_trunc('day', NOW())
                 THEN (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600.0)) / 1000.0
               ELSE (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - date_trunc('day', NOW()))) / 3600.0)) / 1000.0
             END
           )
           FROM ${DB_SCHEMA}.device_runtime_sessions
           WHERE lab_id = $1
         ), 0) AS today_total,
         COALESCE((
           SELECT SUM(
             CASE
               WHEN started_at >= date_trunc('day', NOW())
                 THEN (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600.0)) / 1000.0
               ELSE (($2 * current_amps) * (EXTRACT(EPOCH FROM (NOW() - date_trunc('day', NOW()))) / 3600.0)) / 1000.0
             END
           )
           FROM ${DB_SCHEMA}.device_runtime_sessions
           WHERE lab_id = $1
         ), 0) AS active_today_total,
         COALESCE(SUM(CASE WHEN date = CURRENT_DATE - INTERVAL '1 day' THEN energy_kwh ELSE 0 END), 0) AS yesterday_total,
         COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '6 days' AND date <= CURRENT_DATE THEN energy_kwh ELSE 0 END), 0) AS last_week_total,
         COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '13 days' AND date < CURRENT_DATE - INTERVAL '6 days' THEN energy_kwh ELSE 0 END), 0) AS prior_week_total,
         COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE)::date THEN energy_kwh ELSE 0 END), 0) AS month_total,
         COALESCE(SUM(CASE WHEN date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
                            AND date < date_trunc('month', CURRENT_DATE)::date THEN energy_kwh ELSE 0 END), 0) AS previous_month_total
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1`,
      [parsedLabId, LINE_VOLTAGE_VOLTS]
    );

    const metrics = metricsResult.rows[0] || {};
    const activeToday = Number(metrics.active_today_total || 0);
    const rows = [
      { period: 'Today', consumption: roundNumber(metrics.today_total, 9), previous: metrics.yesterday_total },
      { period: 'Yesterday', consumption: roundNumber(metrics.yesterday_total, 9), previous: metrics.today_total },
      { period: 'Last Week', consumption: roundNumber(Number(metrics.last_week_total || 0) + activeToday, 9), previous: metrics.prior_week_total },
      { period: 'Last Month', consumption: roundNumber(Number(metrics.month_total || 0) + activeToday, 9), previous: metrics.previous_month_total }
    ];

    res.json(rows.map((row) => ({
      period: row.period,
      consumption: row.consumption,
      cost: roundNumber(row.consumption * ENERGY_COST_PER_KWH, 9),
      comparison: Number(formatSignedPercentChange(row.consumption, row.previous).replace('%', ''))
    })));
  } catch (error) {
    console.error("Error fetching energy comparisons:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/power-trend/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const parsedLabId = parseNumericLabId(labId);

    if (labId === 'test-lab') {
      return res.json([{ minute: 'Now', power: 0 }]);
    }

    if (parsedLabId === null) {
      return res.status(400).json({ message: "labId must be numeric" });
    }

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(COALESCE(sensor_reading, 0) * $2), 0) AS current_power_watts
       FROM ${DB_SCHEMA}.devices
       WHERE lab_id::integer = $1`,
      [parsedLabId, LINE_VOLTAGE_VOLTS]
    );

    res.json([
      {
        minute: 'Now',
        power: roundNumber(result.rows[0]?.current_power_watts, 3)
      }
    ]);
  } catch (error) {
    console.error("Error fetching power trend:", error);
    res.status(500).json({ message: "Error" });
  }
});

// ================= START =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on ${PORT}`);
  await ensureDeviceRuntimeSessionsTable();
  await initializeRuntimeSessionsFromLiveDevices();
  await initializeDeviceStates();
});
