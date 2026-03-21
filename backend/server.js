const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const axios = require("axios");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const pool = require("./db");
require("dotenv").config();

const app = express();
const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

// Store previous device states to detect changes
let previousDeviceStates = new Map();

// ESP32 IP Configuration
const ESP32_IP = "http://10.70.103.109";

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

// ================= ZONES TABLE SETUP =================

// Create zones table if it doesn't exist
app.post("/api/setup-zones-table", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.zones (
        id SERIAL PRIMARY KEY,
        lab_id BIGINT NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        zone_name VARCHAR(100),
        zone_coordinates JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(lab_id, device_id, zone_name)
      )
    `);

    res.json({ message: "Zones table created successfully" });
  } catch (error) {
    console.error("Error creating zones table:", error);
    res.status(500).json({ message: "Server error" });
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

    // Save zones to file for main.py to use
    const zonesPath = path.join(__dirname, '../occupancy_detection/zones.json');
    fs.writeFileSync(zonesPath, JSON.stringify(zones, null, 2));

    console.log(`Starting detection for lab ${labId} with zones:`, zones);

    // Start the main.py detection script
    detectionProcess = spawn('python', ['main.py'], {
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
          // Parse status updates like "Updated 1 to ON"
          const match = line.match(/Updated (\d+) to (ON|OFF)/);
          if (match) {
            const fanId = match[1];
            const status = match[2] === 'ON';
            // Set status for all zones with this fan ID
            Object.keys(currentDetectionStatus).forEach(zoneKey => {
              if (zoneKey.endsWith(`_${fanId}`)) {
                currentDetectionStatus[zoneKey] = status;
              }
            });
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

// ================= ZONE CONFIGURATION =================

app.post("/api/labs/:labId/configure-zones", async (req, res) => {
  try {
    const { labId } = req.params;

    console.log(`Starting zone configuration for lab ${labId}`);

    // Run the zone configuration Python script
    const pythonProcess = spawn('python', ['zoneConfig.py'], {
      cwd: '../occupancy_detection',
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

    if (labId === 'test-lab') {
      return res.json([
        { metric: 'Total Energy Today', value: '12.5 kWh', change: '+2.3%' },
        { metric: 'Active Devices', value: '3', change: '0%' },
        { metric: 'Peak Power', value: '450W', change: '-5.2%' },
        { metric: 'Average Temperature', value: '24°C', change: '+0.5°C' }
      ]);
    }

    // Mock data for real labs
    res.json([
      { metric: 'Total Energy Today', value: '15.2 kWh', change: '+3.1%' },
      { metric: 'Active Devices', value: '5', change: '+1' },
      { metric: 'Peak Power', value: '620W', change: '+8.7%' },
      { metric: 'Average Temperature', value: '23°C', change: '-1°C' }
    ]);
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/weekly-energy-cost/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    if (labId === 'test-lab') {
      const data = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        data.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          energy: (Math.random() * 15 + 5).toFixed(2),
          cost: (Math.random() * 2 + 0.5).toFixed(2)
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
        energy: (Math.random() * 20 + 8).toFixed(2),
        cost: (Math.random() * 3 + 1).toFixed(2)
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

    if (labId === 'test-lab') {
      const data = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      months.forEach(month => {
        data.push({
          month: month,
          consumption: (Math.random() * 300 + 200).toFixed(2)
        });
      });
      return res.json(data);
    }

    const data = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    months.forEach(month => {
      data.push({
        month: month,
        consumption: (Math.random() * 400 + 250).toFixed(2)
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
      { device: 'Fan 1', consumption: '4.1 kWh', percentage: 28 },
      { device: 'Fan 2', consumption: '3.5 kWh', percentage: 24 },
      { device: 'Lighting', consumption: '2.8 kWh', percentage: 19 },
      { device: 'AC Unit', consumption: '2.2 kWh', percentage: 15 },
      { device: 'Equipment', consumption: '2.0 kWh', percentage: 14 }
    ]);
  } catch (error) {
    console.error("Error fetching top energy consumers:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/peak-usage-hours/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
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
      { hour: '8:00', usage: 520 },
      { hour: '10:00', usage: 750 },
      { hour: '12:00', usage: 820 },
      { hour: '14:00', usage: 780 },
      { hour: '16:00', usage: 690 },
      { hour: '18:00', usage: 410 }
    ]);
  } catch (error) {
    console.error("Error fetching peak usage hours:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/power-trend/:labId", async (req, res) => {
  try {
    const data = [];
    for (let i = 0; i < 12; i++) {
      data.push({ minute: `${i * 5}m`, power: 500 + Math.random() * 100 });
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