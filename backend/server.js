const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const axios = require("axios");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const pool = require("./db");
require("dotenv").config();

const app = express();
const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");
const OCCUPANCY_DIR = path.join(__dirname, "../occupancy_detection");
const ENABLE_DB_TO_ESP32_SYNC = process.env.ENABLE_DB_TO_ESP32_SYNC === "true";

// Store previous device states to detect changes
let previousDeviceStates = new Map();

// ESP32 IP Configuration
const ESP32_IP = "http://192.168.0.114"; 

// Function to trigger ESP32
async function triggerESP32(deviceId, state) {
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

    res.status(201).json({
      message: "Lab created successfully",
      lab: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating lab:", error);
    res.status(500).json({ message: "Server error" });
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

    const result = await pool.query(
      `SELECT
         l.lab_id,
         l.name AS lab_name,
         COALESCE(d.current_power_watts, 0) AS current_power_watts,
         COALESCE(d.energy_today_kwh, 0) AS energy_today_kwh,
         COALESCE(d.active_devices, 0) AS active_devices,
         d.last_updated
       FROM ${DB_SCHEMA}.labs l
       LEFT JOIN ${DB_SCHEMA}.lab_dashboard d ON l.lab_id = d.lab_id
       WHERE l.lab_id = $1
       LIMIT 1`,
      [labId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lab not found" });
    }

    res.json(result.rows[0]);
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
      `SELECT
         l.lab_id,
         l.name AS lab_name,
         COALESCE(d.current_power_watts, 0) AS current_power_watts,
         COALESCE(d.energy_today_kwh, 0) AS energy_today_kwh,
         COALESCE(d.active_devices, 0) AS active_devices,
         d.last_updated
       FROM ${DB_SCHEMA}.labs l
       LEFT JOIN ${DB_SCHEMA}.lab_dashboard d ON l.lab_id = d.lab_id
       WHERE l.department_id = $1
         AND l.name = $2
       LIMIT 1`,
      [departmentId, labName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lab not found" });
    }

    res.json(result.rows[0]);
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

// ================= ZONE CONFIGURATION =================

app.post("/api/labs/:labId/configure-zones", async (req, res) => {
  try {
    const { labId } = req.params;

    console.log(`Starting zone configuration for lab ${labId}`);

    // Run the zone configuration Python script
    const pythonExecutable = path.join(__dirname, '../occupancy_detection/venv/bin/python');
    const pythonProcess = spawn(pythonExecutable, ['zoneConfig.py'], {
      cwd: path.join(__dirname, '../occupancy_detection'),
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      console.log(`Zone configuration process exited with code ${code}`);
      console.log('Output:', output);

      if (errorOutput) {
        console.error('Error output:', errorOutput);
      }

      if (code === 0) {
        res.json({
          message: "Zone configuration completed successfully",
          output: output
        });
      } else {
        res.status(500).json({
          message: "Zone configuration failed",
          error: errorOutput,
          output: output
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start zone configuration process:', error);
      res.status(500).json({
        message: "Failed to start zone configuration",
        error: error.message
      });
    });

  } catch (error) {
    console.error("Error in zone configuration:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ENERGY =================

app.get("/api/energy-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
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

    const result = await pool.query(
      `SELECT date, SUM(energy_kwh) total
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id=$1 GROUP BY date`,
      [labId]
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
  try {
    const { device_id, lab_id, status, current } = req.body;

    if (!device_id || !lab_id || status === undefined || current === undefined) {
      return res.status(400).json({
        message: "device_id, lab_id, status, current required"
      });
    }

    console.log("Received device update:", { device_id, lab_id, status, current });
    const deviceStatus = status === "ON";

    const result = await pool.query(
      `UPDATE ${DB_SCHEMA}.devices
       SET device_status = $1,
           sensor_reading = $2
       WHERE device_id = $3 AND lab_id = $4`,
      [deviceStatus, current, device_id, lab_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Device not found for this lab"
      });
    }

    res.status(200).json({ message: "Updated successfully" });

  } catch (error) {
    console.error("Error updating device:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ANALYTICS =================

app.get("/api/analytics-summary/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Use consistent data based on labId to ensure same results every time
    const labHash = Math.abs(labId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;

    if (labId === 'test-lab') {
      return res.json([
        { metric: 'Total Energy Today', value: '12.5 kWh', change: '+2.3%' },
        { metric: 'Active Devices', value: '3', change: '0%' },
        { metric: 'Peak Power', value: '450W', change: '-5.2%' },
        { metric: 'Average Temperature', value: '24°C', change: '+0.5°C' }
      ]);
    }

    // Consistent data for real labs based on labId hash
    const baseEnergy = 10 + (labHash % 10);
    const baseDevices = 3 + (labHash % 5);
    const basePower = 400 + (labHash % 300);
    const baseTemp = 20 + (labHash % 8);

    res.json([
      { metric: 'Total Energy Today', value: `${baseEnergy.toFixed(1)} kWh`, change: `+${(labHash % 5 + 1)}.${labHash % 9}%` },
      { metric: 'Active Devices', value: baseDevices.toString(), change: labHash % 2 === 0 ? '+1' : '0%' },
      { metric: 'Peak Power', value: `${basePower}W`, change: labHash % 2 === 0 ? `+${labHash % 10}%` : `-${labHash % 10}%` },
      { metric: 'Average Temperature', value: `${baseTemp}°C`, change: labHash % 2 === 0 ? `+${labHash % 3}°C` : `-${labHash % 2}°C` }
    ]);
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/weekly-energy-cost/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const labHash = Math.abs(labId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;

    if (labId === 'test-lab') {
      const data = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        data.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          energy: (5 + labHash % 10 + i).toFixed(2),
          cost: (0.5 + labHash % 3 + i * 0.1).toFixed(2)
        });
      }
      return res.json(data);
    }

    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      data.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        energy: (8 + labHash % 12 + i).toFixed(2),
        cost: (1 + labHash % 4 + i * 0.2).toFixed(2)
      });
    }
    res.json(data);
  } catch (error) {
    console.error("Error fetching weekly energy cost:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/six-month-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const labHash = Math.abs(labId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;

    if (labId === 'test-lab') {
      const data = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      months.forEach((month, i) => {
        data.push({
          month: month,
          consumption: (200 + labHash % 100 + i * 20).toFixed(2)
        });
      });
      return res.json(data);
    }

    const data = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    months.forEach((month, i) => {
      data.push({
        month: month,
        consumption: (250 + labHash % 150 + i * 25).toFixed(2)
      });
    });
    res.json(data);
  } catch (error) {
    console.error("Error fetching six month consumption:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/top-energy-consumers/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const labHash = Math.abs(labId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;

    if (labId === 'test-lab') {
      return res.json([
        { device: 'Fan 1', consumption: '3.2 kWh', percentage: 25 },
        { device: 'Fan 2', consumption: '2.8 kWh', percentage: 22 },
        { device: 'Lighting', consumption: '2.1 kWh', percentage: 16 },
        { device: 'AC Unit', consumption: '1.9 kWh', percentage: 15 },
        { device: 'Equipment', consumption: '2.5 kWh', percentage: 22 }
      ]);
    }

    res.json([
      { device: 'Fan 1', consumption: `${(3 + labHash % 2).toFixed(1)} kWh`, percentage: 25 + labHash % 5 },
      { device: 'Fan 2', consumption: `${(2.5 + labHash % 2).toFixed(1)} kWh`, percentage: 20 + labHash % 6 },
      { device: 'Lighting', consumption: `${(2 + labHash % 2).toFixed(1)} kWh`, percentage: 15 + labHash % 5 },
      { device: 'AC Unit', consumption: `${(1.8 + labHash % 2).toFixed(1)} kWh`, percentage: 12 + labHash % 5 },
      { device: 'Equipment', consumption: `${(2.2 + labHash % 2).toFixed(1)} kWh`, percentage: 18 + labHash % 6 }
    ]);
  } catch (error) {
    console.error("Error fetching top energy consumers:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/peak-usage-hours/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const labHash = Math.abs(labId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;

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

    res.json([
      { hour: '8:00', usage: 450 + labHash % 100 },
      { hour: '10:00', usage: 650 + labHash % 150 },
      { hour: '12:00', usage: 700 + labHash % 200 },
      { hour: '14:00', usage: 650 + labHash % 180 },
      { hour: '16:00', usage: 550 + labHash % 160 },
      { hour: '18:00', usage: 300 + labHash % 120 }
    ]);
  } catch (error) {
    console.error("Error fetching peak usage hours:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/energy-comparisons/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const labHash = Math.abs(labId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;

    if (labId === 'test-lab') {
      return res.json([
        { period: 'Today', consumption: 12.5, cost: 2.50, comparison: -2.3 },
        { period: 'Yesterday', consumption: 14.8, cost: 2.96, comparison: 0 },
        { period: 'Last Week', consumption: 89.2, cost: 17.84, comparison: 5.1 },
        { period: 'Last Month', consumption: 376.8, cost: 75.36, comparison: 8.7 }
      ]);
    }

    // Consistent data for real labs based on labId hash
    const baseConsumption = 10 + (labHash % 15);
    const baseCost = baseConsumption * 0.2;

    res.json([
      {
        period: 'Today',
        consumption: parseFloat((baseConsumption + labHash % 5).toFixed(1)),
        cost: parseFloat((baseCost + labHash % 2).toFixed(2)),
        comparison: parseFloat((labHash % 10 - 5).toFixed(1))
      },
      {
        period: 'Yesterday',
        consumption: parseFloat((baseConsumption + labHash % 8).toFixed(1)),
        cost: parseFloat((baseCost + labHash % 3).toFixed(2)),
        comparison: 0
      },
      {
        period: 'Last Week',
        consumption: parseFloat((baseConsumption * 7 + labHash % 20).toFixed(1)),
        cost: parseFloat((baseCost * 7 + labHash % 8).toFixed(2)),
        comparison: parseFloat((labHash % 12 + 3).toFixed(1))
      },
      {
        period: 'Last Month',
        consumption: parseFloat((baseConsumption * 30 + labHash % 50).toFixed(1)),
        cost: parseFloat((baseCost * 30 + labHash % 20).toFixed(2)),
        comparison: parseFloat((labHash % 15 + 5).toFixed(1))
      }
    ]);
  } catch (error) {
    console.error("Error fetching energy comparisons:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/power-trend/:labId", async (req, res) => {
  try {
    const data = [];
    const labHash = Math.abs(req.params.labId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 100;
    for (let i = 0; i < 12; i++) {
      data.push({ minute: `${i * 5}m`, power: 500 + labHash % 100 + i * 10 });
    }
    res.json(data);
  } catch {
    res.status(500).json({ message: "Error" });
  }
});

// ================= START =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on ${PORT}`);
  await initializeDeviceStates();
});
