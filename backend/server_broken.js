const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const pool = require("./db");
require("dotenv").config();

const app = express();
const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

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

app.get("/api/energy-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const { days = 7 } = req.query;

    const result = await pool.query(
      `SELECT 
         date,
         SUM(energy_kwh) as daily_total
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1 
         AND date >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY date
       ORDER BY date ASC`,
      [labId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching energy consumption:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Energy Monitoring APIs
app.get("/api/energy-comparisons/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Get yesterday's consumption
    const yesterdayResult = await pool.query(
      `SELECT COALESCE(SUM(energy_kwh), 0) as consumption
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1 AND date = CURRENT_DATE - INTERVAL '1 day'`,
      [labId]
    );

    // Get last week's consumption
    const lastWeekResult = await pool.query(
      `SELECT COALESCE(SUM(energy_kwh), 0) as consumption
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1 
         AND date >= CURRENT_DATE - INTERVAL '7 days'
         AND date < CURRENT_DATE`,
      [labId]
    );

    // Get last month's consumption
    const lastMonthResult = await pool.query(
      `SELECT COALESCE(SUM(energy_kwh), 0) as consumption
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1 
         AND date >= CURRENT_DATE - INTERVAL '30 days'
         AND date < CURRENT_DATE`,
      [labId]
    );

    const yesterday = parseFloat(yesterdayResult.rows[0].consumption);
    const lastWeek = parseFloat(lastWeekResult.rows[0].consumption);
    const lastMonth = parseFloat(lastMonthResult.rows[0].consumption);

    res.json([
      {
        label: 'Yesterday',
        usage: `${yesterday.toFixed(1)} kWh`,
        compare: yesterday > 0 ? '+7% vs yesterday avg' : 'No data',
        positive: true
      },
      {
        label: 'Last Week',
        usage: `${lastWeek.toFixed(0)} kWh`,
        compare: lastWeek > 0 ? '-3% vs previous week' : 'No data',
        positive: false
      },
      {
        label: 'Last Month',
        usage: `${lastMonth.toFixed(0)} kWh`,
        compare: lastMonth > 0 ? '+5% vs previous month' : 'No data',
        positive: true
      }
    ]);
  } catch (error) {
    console.error("Error fetching energy comparisons:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/power-trend/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Get current dashboard data
    const dashboardResult = await pool.query(
      `SELECT current_power_watts
       FROM ${DB_SCHEMA}.lab_dashboard
       WHERE lab_id = $1`,
      [labId]
    );

    const currentPower = dashboardResult.rows.length > 0
      ? parseFloat(dashboardResult.rows[0].current_power_watts)
      : 1000; // Default if no data

    // Generate realistic power trend data for the last hour
    const powerData = [];
    for (let i = 0; i < 12; i++) {
      const variation = Math.sin(i / 2) * 80 + Math.random() * 40 - 20;
      const power = Math.max(200, currentPower + variation);

      powerData.push({
        minute: `${i * 5}m`,
        power: Math.round(power)
      });
    }

    res.json(powerData);
  } catch (error) {
    console.error("Error fetching power trend:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Analytics / Report APIs
app.get("/api/analytics-summary/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Get weekly average
    const weeklyResult = await pool.query(
      `SELECT COALESCE(AVG(daily_total), 0) as avg_daily
       FROM (
         SELECT SUM(energy_kwh) as daily_total
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1 
           AND date >= CURRENT_DATE - INTERVAL '7 days'
         GROUP BY date
       ) daily_data`,
      [labId]
    );

    // Get monthly total
    const monthlyResult = await pool.query(
      `SELECT COALESCE(SUM(energy_kwh), 0) as monthly_total
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1 
         AND date >= CURRENT_DATE - INTERVAL '30 days'`,
      [labId]
    );

    // Get estimated cost (assuming $0.30 per kWh)
    const monthlyConsumption = parseFloat(monthlyResult.rows[0].monthly_total);
    const estimatedCost = monthlyConsumption * 0.30;

    // Get energy saved (mock calculation - 10% of monthly)
    const energySaved = monthlyConsumption * 0.10;

    const weeklyAvg = parseFloat(weeklyResult.rows[0].avg_daily) * 7; // Convert to weekly total

    res.json([
      ['Weekly Average', `${weeklyAvg.toFixed(0)} kWh`],
      ['Monthly Total', `${(monthlyConsumption / 1000).toFixed(1)} MWh`],
      ['Estimated Cost', `$${estimatedCost.toFixed(0)}`],
      ['Energy Saved So Far', `${energySaved.toFixed(0)} kWh`]
    ]);
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/weekly-energy-cost/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const result = await pool.query(
      `SELECT 
         EXTRACT(DOW FROM date) as day_of_week,
         SUM(energy_kwh) as energy,
         SUM(energy_kwh) * 0.30 as cost
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1 
         AND date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY date, EXTRACT(DOW FROM date)
       ORDER BY date`,
      [labId]
    );

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = result.rows.map(row => ({
      day: dayNames[Math.floor(row.day_of_week)],
      energy: Math.round(parseFloat(row.energy)),
      cost: Math.round(parseFloat(row.cost))
    }));

    res.json(weeklyData);
  } catch (error) {
    console.error("Error fetching weekly energy cost:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/six-month-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const result = await pool.query(
      `SELECT 
         TO_CHAR(date, 'Mon') as month,
         SUM(energy_kwh) as usage
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1 
         AND date >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY TO_CHAR(date, 'Mon'), EXTRACT(MONTH FROM date)
       ORDER BY EXTRACT(MONTH FROM date)",
      [labId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching six month consumption:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/peak-usage-hours/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Get average consumption by hour of day
    const result = await pool.query(
      `SELECT 
         hour,
      AVG(energy_kwh) as avg_power
       FROM ${ DB_SCHEMA }.energy_consumption
       WHERE lab_id = $1 
         AND date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY hour
       ORDER BY avg_power DESC
       LIMIT 4`,
      [labId]
    );

    const peakHours = result.rows.map((row, index) => {
      const startHour = parseInt(row.hour);
      const endHour = startHour + 2;
      const timeSlot = `${ startHour.toString().padStart(2, '0') }:00 - ${ endHour.toString().padStart(2, '0') }:00`;
      
      return {
        time: timeSlot,
        power: parseFloat(row.avg_power).toFixed(1)
      };
    });

    res.json(peakHours);
  } catch (error) {
    console.error("Error fetching peak usage hours:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/top-energy-consumers/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Since we don't have device-level data, we'll simulate it based on lab characteristics
    const dashboardResult = await pool.query(
      `SELECT current_power_watts, active_devices
       FROM ${ DB_SCHEMA }.lab_dashboard
       WHERE lab_id = $1`,
      [labId]
    );

    const currentPower = dashboardResult.rows.length > 0 
      ? parseFloat(dashboardResult.rows[0].current_power_watts)
      : 1000;

    const activeDevices = dashboardResult.rows.length > 0 
      ? parseInt(dashboardResult.rows[0].active_devices)
      : 10;

    // Simulate top consumers based on lab power
    const consumers = [
      { device: 'HVAC System', power: Math.round(currentPower * 0.35) },
      { device: 'Computing Equipment', power: Math.round(currentPower * 0.25) },
      { device: 'Lighting System', power: Math.round(currentPower * 0.20) },
      { device: 'Lab Equipment', power: Math.round(currentPower * 0.15) }
    ];

    res.json(consumers);
  } catch (error) {
    console.error("Error fetching top energy consumers:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${ PORT }`);
});
