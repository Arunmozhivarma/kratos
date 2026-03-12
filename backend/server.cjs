const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const axios = require("axios");
const pool = require("./db");
require("dotenv").config();

const app = express();
const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

// Store previous device states to detect changes
let previousDeviceStates = new Map();

// ESP32 IP Configuration - Update this for different networks
const ESP32_IP = "http://10.205.108.109";

// Function to trigger ESP32 based on device state
async function triggerESP32(deviceId, state) {
  try {
    if (state) {
      // State is true (ON) -> trigger /off endpoint (ESP32 logic is inverted)
      console.log(`Turning fan ${deviceId} OFF (ESP32 logic inverted)`);
      await axios.get(`${ESP32_IP}/off`, { timeout: 5000 });
    } else {
      // State is false (OFF) -> trigger /on endpoint (ESP32 logic is inverted)
      console.log(`Turning fan ${deviceId} ON (ESP32 logic inverted)`);
      await axios.get(`${ESP32_IP}/on`, { timeout: 5000 });
    }
    console.log(`Successfully triggered ESP32 for fan ${deviceId}`);
  } catch (espError) {
    console.error(`Failed to trigger ESP32 for fan ${deviceId}:`, espError.message);
  }
}

// Function to poll database and trigger ESP32 for state changes
async function pollDatabaseForChanges() {
  try {
    const result = await pool.query(
      `SELECT device_id, device_status FROM ${DB_SCHEMA}.devices`
    );

    for (const device of result.rows) {
      const deviceId = device.device_id;
      const currentState = device.device_status;
      const previousState = previousDeviceStates.get(deviceId);

      // If state changed, trigger ESP32
      if (previousState !== undefined && previousState !== currentState) {
        console.log(`Device ${deviceId} state changed from ${previousState} to ${currentState}`);
        await triggerESP32(deviceId, currentState);
      }

      // Update previous state
      previousDeviceStates.set(deviceId, currentState);
    }
  } catch (error) {
    console.error("Error polling database:", error);
  }
}

// Start database polling every 2 seconds
setInterval(pollDatabaseForChanges, 2000);

// Initialize previous states on startup
async function initializeDeviceStates() {
  try {
    const result = await pool.query(
      `SELECT device_id, device_status FROM ${DB_SCHEMA}.devices`
    );

    for (const device of result.rows) {
      previousDeviceStates.set(device.device_id, device.device_status);
    }
    console.log("Initialized device states:", Object.fromEntries(previousDeviceStates));
  } catch (error) {
    console.error("Error initializing device states:", error);
  }
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("KRATOS backend is running");
});

app.get("/api/departments", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT department_id, name FROM ${DB_SCHEMA}.departments ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/labs/:departmentId", async (req, res) => {
  try {
    const { departmentId } = req.params;

    const result = await pool.query(
      `SELECT lab_id, name
       FROM ${DB_SCHEMA}.labs
       WHERE department_id = $1 AND is_active = true
       ORDER BY name`,
      [departmentId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching labs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/dashboard/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

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

app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, department_id, password } = req.body;

    if (!username || !email || !department_id || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.users (username, email, department_id, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, username, email, department_id`,
      [username, email, department_id, hashedPassword]
    );

    res.status(201).json({
      message: "Signup successful",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === "23505") {
      return res.status(409).json({ message: "Username or email already exists" });
    }

    res.status(500).json({ message: "Signup failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { identifier, department_id, password } = req.body;

    if (!identifier || !department_id || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const result = await pool.query(
      `SELECT user_id, username, email, department_id, password_hash
       FROM ${DB_SCHEMA}.users
       WHERE (username = $1 OR email = $1)
         AND department_id = $2
         AND is_active = true`,
      [identifier, department_id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({
      message: "Login successful",
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        department_id: user.department_id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Device endpoints
app.post("/api/devices", async (req, res) => {
  try {
    const { device_id } = req.body;

    if (!device_id) {
      return res.status(400).json({ message: "device_id is required" });
    }

    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.devices (device_id, device_status)
       VALUES ($1, false)
       ON CONFLICT (device_id) DO NOTHING
       RETURNING device_id, device_status`,
      [device_id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ message: "Device already exists" });
    }

    res.status(201).json({
      message: "Device created successfully",
      device: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/devices/update", async (req, res) => {
  try {
    const { fan_id, status } = req.body;

    if (!fan_id || status === undefined) {
      return res.status(400).json({ message: "fan_id and status are required" });
    }

    const stateValue = status === "ON";

    const result = await pool.query(
      `UPDATE ${DB_SCHEMA}.devices
       SET device_status = $1
       WHERE device_id = $2
       RETURNING device_id, device_status`,
      [stateValue, fan_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Device not found" });
    }

    // ESP32 trigger is now handled by database polling mechanism
    // The pollDatabaseForChanges() function will detect this state change
    // and trigger the ESP32 accordingly

    res.json({
      message: "Device updated successfully",
      device: result.rows[0]
    });

  } catch (error) {
    console.error("Error updating device:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize device states and start polling
  await initializeDeviceStates();
  console.log("Database polling started for ESP32 triggers");
});
