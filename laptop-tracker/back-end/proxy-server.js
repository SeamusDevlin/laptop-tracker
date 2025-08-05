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

  // New endpoint for Windows devices
  const INTUNE_ENABLED = process.env.INTUNE_INTEGRATION_ENABLED === 'true';
  const INTUNE_GRAPH_API_ENDPOINT = process.env.INTUNE_GRAPH_API_ENDPOINT;
  const INTUNE_API_SCOPES = process.env.INTUNE_API_SCOPES;
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const TENANT_ID = process.env.TENANT_ID;

  // Helper to get Microsoft Graph access token
  async function getIntuneAccessToken() {
      const fetch = require('node-fetch');
      const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
      const params = new URLSearchParams();
      params.append('client_id', CLIENT_ID);
      params.append('client_secret', CLIENT_SECRET);
      params.append('scope', 'https://graph.microsoft.com/.default');
      params.append('grant_type', 'client_credentials');
      const res = await fetch(url, {
          method: 'POST',
          body: params
      });
      const data = await res.json();
      if (!data.access_token) throw new Error('Failed to get Intune access token');
      return data.access_token;
  }

  // Fetch Windows devices from Intune
  async function fetchIntuneDevices(accessToken) {
      const fetch = require('node-fetch');
      const url = `${INTUNE_GRAPH_API_ENDPOINT}/deviceManagement/managedDevices?$filter=operatingSystem eq 'Windows'`;
      console.log('Intune API endpoint:', url);
      console.log('Intune access token (first 20 chars):', accessToken ? accessToken.substring(0, 20) : 'undefined');
      const res = await fetch(url, {
          headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
          }
      });
      const data = await res.json();
      console.log('Raw Intune API response:', JSON.stringify(data, null, 2)); // Debug log

      // Handle Intune API errors (Forbidden, permissions, etc.)
      if (data.error) {
          console.error('Intune API error:', data.error.message);
          // Return the raw error object for frontend troubleshooting
          throw {
              isIntuneApiError: true,
              code: data.error.code,
              message: data.error.message,
              raw: data.error,
              hint: 'Check Azure app registration permissions, admin consent, and that your account has access to Intune. Also verify the tenant and app registration match your environment.'
          };
      }

      // Normalize device fields for frontend compatibility
      return (data.value || []).map(device => ({
          device_name: device.deviceName || device.name || device.managedDeviceName || 'Unknown Device',
          user: {
              name: device.userDisplayName || device.userPrincipalName || device.ownerUserPrincipalName || 'Unknown User',
              email: device.userPrincipalName || device.ownerUserPrincipalName || ''
          },
          model: device.model || device.manufacturer || device.deviceModel || 'Unknown Model',
          os_version: device.operatingSystemVersion || device.osVersion || 'Unknown OS',
          serial_number: device.serialNumber || device.deviceSerialNumber || 'Unknown Serial',
          asset_tag: device.deviceTag || '',
          first_enrollment: device.enrolledDateTime || device.enrollmentDateTime || device.lastSyncDateTime || device.lastContact || new Date().toISOString()
      }));
  }

  app.get('/api/windows-devices', async (req, res) => {
      if (!INTUNE_ENABLED) {
          return res.status(403).json({ error: 'Intune integration not enabled' });
      }
      try {
          const accessToken = await getIntuneAccessToken();
          const devices = await fetchIntuneDevices(accessToken);

          // Teams notification logic (same as Kandji)
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
                  const firstEnrollment = device.first_enrollment || new Date().toISOString();
                  const enrollmentDate = new Date(firstEnrollment);
                  if (isNaN(enrollmentDate)) continue;
                  const ageYears = (Date.now() - enrollmentDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                  if (ageYears >= 4 && serial && !notifiedSerials.includes(serial)) {
                      try {
                          await sendTeamsNotification(TEAMS_WEBHOOK_URL, device);
                          notifiedSerials.push(serial);
                          updated = true;
                          console.log(`Teams notification sent for Windows device: ${serial}`);
                      } catch (notifyErr) {
                          console.error(`Failed to send Teams notification for Windows device ${serial}:`, notifyErr);
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

          res.json({ devices });
      } catch (error) {
          console.error('Error fetching from Intune:', error);
          // If error is from Intune API, return raw error for frontend troubleshooting
          if (error.isIntuneApiError) {
              return res.status(500).json({
                  error: 'Failed to fetch devices from Intune',
                  code: error.code,
                  message: error.message,
                  raw: error.raw,
                  hint: error.hint
              });
          }
          res.status(500).json({ 
              error: 'Failed to fetch devices from Intune',
              message: error.message,
              hint: 'Check Azure app registration permissions and admin consent for DeviceManagementManagedDevices.Read.All'
          });
      }
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
    console.log(`   GET /api/windows-devices - Fetch Windows devices from Intune`);
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