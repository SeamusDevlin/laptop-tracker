# laptop-tracker

## Overview

**laptop-tracker** is a dashboard for tracking Kandji-managed devices, designed for IT teams. It provides:

- **Device Age Tracking:** Calculates device age from enrollment date and categorizes devices as "Good", "Warning", or "Needs Replacement".
- **Live Stats:** Shows total devices, devices needing replacement, warnings, and those in good condition.
- **Filtering & Search:** Filter devices by age category and search by user, device name, model, or serial number.
- **Auto-Refresh:** Device data updates every 5 minutes.
- **Teams Notifications:** Sends notifications to a Microsoft Teams channel when a device reaches 4+ years old (configurable).
- **Proxy Server:** Securely proxies requests to the Kandji API, keeping your API token safe.
- **Health Endpoint:** `/health` endpoint for monitoring proxy server status.

## Features

- **Front-end Dashboard:** Responsive UI for viewing and filtering device data.
- **Back-end Proxy:** Node.js Express server that fetches device data from Kandji and triggers Teams notifications.
- **Teams Integration:** Notifies your team when devices need replacement, only once per device.
- **Configurable:** All sensitive settings (API tokens, Teams webhook) are managed via `.env` file.

## Setup Instructions

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v14 or higher
- [npm](https://www.npmjs.com/)
- Kandji API token and subdomain
- (Optional) Microsoft Teams Incoming Webhook URL

### 2. Clone the Repository

```bash
git clone https://github.com/yourusername/laptop-tracker.git
cd laptop-tracker
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Edit `/back-end/.env` and set:

```
KANDJI_SUBDOMAIN=your-subdomain
KANDJI_API_TOKEN=your-kandji-api-token

TEAMS_WEBHOOK_URL=https://your-teams-webhook-url
TEAMS_NOTIFICATIONS_ENABLED=true
```

- Set `TEAMS_NOTIFICATIONS_ENABLED=false` to disable Teams notifications.

### 5. Start the Proxy Server

```bash
node back-end/proxy-server.js
```

- The proxy server runs on `http://localhost:3001`
- Endpoints:
  - `GET /api/devices` - Fetches devices from Kandji
  - `GET /health` - Health check

### 6. Start the Front-End

#### Option A: Open HTML Directly

- Open `/front-end/index.html` in your browser.

#### Option B: Serve Front-End Locally (Recommended)

Using Python:

```bash
cd front-end
python -m http.server 8000
```

Or using Node.js:

```bash
npm install -g http-server
cd front-end
http-server -p 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in your browser.

### 7. Usage

- Click "Refresh Now" to fetch device data.
- Use filters and search to find devices.
- Stats and device list update automatically every 5 minutes.
- Teams notifications are sent for devices needing replacement (4+ years old), only once per device.

## Teams Notifications

- Notifications are sent to the configured Teams webhook for devices reaching 4+ years old.
- Notified devices are tracked in a local file to prevent duplicate alerts.
- To disable, set `TEAMS_NOTIFICATIONS_ENABLED=false` in `.env`.

## Development & Testing

- Proxy server code is in `/back-end/proxy-server.js`
- Front-end code is in `/front-end/`
- Run tests with:

```bash
npm test
```

## Troubleshooting

- If you see errors about fetching devices, ensure the proxy server is running and `.env` is configured.
- For Teams notifications, verify your webhook URL and that notifications are enabled.