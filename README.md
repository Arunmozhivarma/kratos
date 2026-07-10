# KRATOS – Smart Energy Management System

An AI-powered smart energy management system that combines computer vision, machine learning, and IoT to automate energy usage based on real-time occupancy.

## Overview

KRATOS reduces unnecessary energy consumption in institutional and commercial spaces by detecting occupancy, predicting room usage, and automatically controlling electrical appliances. The system integrates a camera, ESP32-based controllers, energy sensors, and a web dashboard to provide intelligent, occupancy-aware automation.

## Features

- Real-time occupancy detection using YOLOv8
- Occupancy prediction using Random Forest
- Automated control of lights and fans
- Zone-wise energy monitoring
- Web dashboard for monitoring and manual control
- Energy usage analytics and reporting

## System Architecture

                     +----------------------+
                     |     IP/USB Camera    |
                     +----------+-----------+
                                |
                                v
                   +-------------------------+
                   | YOLOv8 + OpenCV         |
                   | Occupancy Detection     |
                   +-----------+-------------+
                               |
                               v
                   +-------------------------+
                   | Occupancy Processing    |
                   | Zone Mapping            |
                   +-----------+-------------+
                               |
                               v
                   +-------------------------+
                   | Random Forest Model     |
                   | Occupancy Prediction    |
                   +-----------+-------------+
                               |
                               v
                   +-------------------------+
                   | Node.js Backend         |
                   | Decision Engine         |
                   +-----+-------------+-----+
                         |             |
          Stores Data    |             | Sends Commands
                         |             |
                         v             v
              +----------------+   +----------------+
              | PostgreSQL     |   | ESP32          |
              | (Supabase)     |   | Relay Control  |
              +----------------+   +--------+-------+
                                            |
                                            v
                                 +----------------------+
                                 | Lights / Fans        |
                                 | Electrical Devices   |
                                 +----------------------+

                                           ^
                                           |
                                +----------------------+
                                | React Dashboard      |
                                | Monitoring & Control |
                                +----------------------+ 


## Tech Stack

**Frontend**
- React.js

**Backend**
- Node.js
- Express.js

**Database**
- PostgreSQL (Supabase)

**AI**
- YOLOv8
- OpenCV
- Random Forest

**Hardware**
- ESP32
- Energy Sensors
- Relay Module
- IP Camera

## Workflow

1. Camera captures live video.
2. YOLOv8 detects occupants and maps them to predefined zones.
3. Historical occupancy data is processed using a Random Forest model to estimate occupancy probability.
4. The backend determines whether appliances should remain ON or be switched OFF.
5. ESP32 receives control commands and operates relays connected to electrical devices.
6. The dashboard displays occupancy, device status, and energy consumption in real time.

## Results

- Accurate real-time occupancy detection
- 93.13% occupancy prediction accuracy
- Reduced idle-time energy consumption
- Automated zone-based device control
- Centralized monitoring and analytics
