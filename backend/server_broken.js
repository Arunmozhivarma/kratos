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

// Store previous device states to detect changes
let previousDeviceStates = new Map();

// ESP32 IP Configuration
const ESP32_IP = "http://10.20.3.109";

// Function to trigger ESP32
async function triggerESP32(deviceId, state) {
  try {
    if (state) {
      console.log(`Turning fan ${deviceId} OFF (ESP32 logic inverted)`);
      await axios.get(`${ESP32_IP}/off`, { timeout: 5000 });
    } else {
      console.log(`Turning fan ${deviceId} ON (ESP32 logic inverted)`);
      await axios.get(`${ESP32_IP}/on`, { timeout: 5000 });
    }
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

setInterval(pollDatabaseForChanges, 2000);

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

// ================= DEVICES =================

app.post("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.devices (device_id, device_status)
       VALUES ($1,false)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.body.device_id]
    );

    if (!result.rows.length)
      return res.status(409).json({ message: "Exists" });

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
  try {
    const { labId, zones } = req.body;

    if (!labId) {
      return res.status(400).json({ message: "labId is required" });
    }

    if (labId === 'test-lab') {
      return res.json({ message: "Test lab zones are not persisted", labId, zonesCount: 0, zones: [] });
    }

    // Clear existing zones for this lab
    await pool.query(
      `DELETE FROM ${DB_SCHEMA}.zones WHERE lab_id = $1`,
      [labId]
    );

    // Insert new zones with unique configuration boxes
    for (const [zoneKey, coordinates] of Object.entries(zones)) {
      // Parse zoneKey to extract zone_name and device_id
      // Format: "configBox1_device1" or similar
      const parts = zoneKey.split('_');
      const device_id = parts[parts.length - 1]; // Last part is device_id
      const zone_name = parts.slice(0, -1).join('_'); // Everything except last part

      await pool.query(
        `INSERT INTO ${DB_SCHEMA}.zones (lab_id, device_id, zone_name, zone_coordinates)
         VALUES ($1, $2, $3, $4)`,
        [labId, device_id, zone_name, JSON.stringify(coordinates)]
      );
    }

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
    console.error("Error saving zones:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/start-detection", async (req, res) => {
  try {
    const { labId, zones } = req.body;

    if (detectionProcess) {
      return res.status(400).json({ message: "Detection is already running" });
    }

    console.log(`Starting detection for lab ${labId} with zones:`, zones);

    // Start the main.py detection script supporting cross-platform OS paths
    const isWindows = os.platform() === 'win32';
    const venvPython = isWindows
      ? path.join(__dirname, '../occupancy_detection/venv/Scripts/python.exe')
      : path.join(__dirname, '../occupancy_detection/venv/bin/python');

    // Fallback to global python if venv doesn't exist
    const pythonExecutable = fs.existsSync(venvPython) ? venvPython : (isWindows ? 'python' : 'python3');

    detectionProcess = spawn(pythonExecutable, ['main.py', labId.toString()], {
      cwd: path.join(__dirname, '../occupancy_detection'),
      stdio: 'pipe'
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
    res.json(currentDetectionStatus);
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
    res.status(500).json({ message: "Error" });
  }
    });

// ================= DEVICE UPDATE =================

app.post("/api/devices/update", async (req, res) => {
  try {
    const state = req.body.status === "ON";

    const result = await pool.query(
      `UPDATE ${DB_SCHEMA}.devices
       SET device_status=$1
       WHERE device_id=$2 RETURNING *`,
      [state, req.body.fan_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Update error" });
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