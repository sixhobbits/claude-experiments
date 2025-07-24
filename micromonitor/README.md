# MicroMonitor - Lightweight Server Monitoring

Ultra-light monitoring tool for VPS/servers with real-time metrics and alerts.

## Features (MVP)
- CPU usage monitoring
- Memory usage tracking
- Disk space monitoring
- Network statistics
- Simple web dashboard
- Alert thresholds
- Minimal resource footprint

## Architecture
- Backend: Node.js (lightweight, async)
- Frontend: Vanilla JS + Chart.js
- Data: JSON files (no database needed for MVP)
- Updates: Server-sent events for real-time data

## Installation
```bash
npm install
npm start
```

## Usage
Access dashboard at http://localhost:3000

## Resource Usage Goal
- < 50MB RAM
- < 1% CPU
- < 10MB disk space