require('dotenv').config();

const express = require('express');
const cors = require('cors');
const https = require('https');

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;
const TEAMS_ENABLED = process.env.TEAMS_NOTIFICATIONS_ENABLED === 'true';

// Update your existing KANDJI_CONFIG
const KANDJI_CONFIG = {
    subdomain: process.env.KANDJI_SUBDOMAIN || 'your-subdomain',
    token: process.env.KANDJI_API_TOKEN || 'your-api-token',
    url: `https://${process.env.KANDJI_SUBDOMAIN || 'your-subdomain'}.api.eu.kandji.io/api/v1/devices`
};

// Include the teams-notifications.js 
const {
    loadNotified,
    saveNotified,
    sendTeamsNotification
} = require('./teams-notifications');

// Enable CORS for all routes
const createApp = ({ makeKandjiRequest }) => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Proxy endpoint for Kandji API
  app.get('/api/devices', async (req, res) => {
      console.log('Fetching devices from Kandji API...');
      
      try {
          const data = await makeKandjiRequest(KANDJI_CONFIG.url, KANDJI_CONFIG.token);
          // console.log('Raw Kandji API response:', Array.isArray(data) ? `Array(${data.length})` : typeof data, data);
          const devices = Array.isArray(data.devices) ? data.devices : [];
          
          // Teams notification logic
          if (TEAMS_ENABLED && TEAMS_WEBHOOK_URL) {
              let notifiedSerials;
              try {
                  notifiedSerials = loadNotified();
              } catch (e) {
                  console.error('Failed to load notified serials:', e);
                  notifiedSerials = [];
              }
              let updated = false;
              for (const device of devices) {
                  const serial = device.serial_number;
                  const firstEnrollment = device.first_enrollment || device.last_enrollment || device.last_check_in || new Date().toISOString();
                  const enrollmentDate = new Date(firstEnrollment);
                  if (isNaN(enrollmentDate)) {
                      console.warn(`Invalid enrollment date for device ${serial}:`, firstEnrollment);
                      continue;
                  }
                  const ageYears = (Date.now() - enrollmentDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                  if (ageYears >= 4 && serial && !notifiedSerials.includes(serial)) {
                      try {
                          await sendTeamsNotification(TEAMS_WEBHOOK_URL, device);
                          notifiedSerials.push(serial);
                          updated = true;
                          console.log(`Teams notification sent for device: ${serial}`);
                      } catch (notifyErr) {
                          console.error(`Failed to send Teams notification for ${serial}:`, notifyErr);
                      }
                  }
              }
              if (updated) {
                  try {
                      saveNotified(notifiedSerials);
                  } catch (saveErr) {
                      console.error('Failed to save notified serials:', saveErr);
                  }
              }
          }

          console.log(`Successfully fetched ${devices.length} devices`);
          res.json(data);
      } catch (error) {
          console.error('Error fetching from Kandji API:', error);
          res.status(500).json({ 
              error: 'Failed to fetch devices from Kandji API',
              message: error.message 
          });
      }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
      res.json({ 
          status: 'OK', 
          timestamp: new Date().toISOString(),
          kandjiUrl: KANDJI_CONFIG.url
      });
  });

  return app;
};

// Function to make HTTPS request to Kandji API
function makeKandjiRequest(url, token) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        const request = https.request(url, options, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (parseError) {
                        reject(new Error('Invalid JSON response from Kandji API'));
                    }
                } else {
                    reject(new Error(`Kandji API returned status ${response.statusCode}: ${data}`));
                }
            });
        });

        request.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });

        request.end();
    });
}

// Start the server
const PORT = 3001;
const app = createApp({ makeKandjiRequest });
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log(`Proxying requests to: ${KANDJI_CONFIG.url}`);
    console.log(`Using token: ${KANDJI_CONFIG.token.substring(0, 8)}...`);
    console.log(`\n Available endpoints:`);
    console.log(`   GET /api/devices - Fetch devices from Kandji`);
    console.log(`   GET /health - Health check`);
    console.log(`\n Open your HTML file in a browser to use the device tracker!`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log(' Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// At the very end of the file, add:
module.exports = createApp;
// Or, if you want to export more for testing:
// module.exports = { app, makeKandjiRequest };