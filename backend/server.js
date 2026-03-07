const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const pool = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("KRATOS backend is running");
});

app.get("/api/departments", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT department_id, name FROM kratos.departments ORDER BY name"
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
       FROM kratos.labs
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
       FROM kratos.labs l
       LEFT JOIN kratos.lab_dashboard d ON l.lab_id = d.lab_id
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
       FROM kratos.labs l
       LEFT JOIN kratos.lab_dashboard d ON l.lab_id = d.lab_id
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
      `INSERT INTO kratos.users (username, email, department_id, password_hash)
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
       FROM kratos.users
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
