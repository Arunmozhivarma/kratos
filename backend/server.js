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
}); // ✅ FIXED CLOSING

// ================= ENERGY =================

app.get("/api/energy-consumption/:labId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT date, SUM(energy_kwh) total
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id=$1 GROUP BY date`,
      [req.params.labId]
    );
    res.json(result.rows);
  } catch {
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
}); // ✅ FIXED CLOSING

// ================= ANALYTICS =================

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