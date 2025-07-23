require('dotenv').config();

const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = 3001;

// Update your existing KANDJI_CONFIG
const KANDJI_CONFIG = {
    subdomain: process.env.KANDJI_SUBDOMAIN || 'your-subdomain',
    token: process.env.KANDJI_API_TOKEN || 'your-api-token',
    url: `https://${process.env.KANDJI_SUBDOMAIN || 'your-subdomain'}.api.eu.kandji.io/api/v1/devices`
};
// Include the teams-notifications.js 


// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Proxy endpoint for Kandji API
app.get('/api/devices', async (req, res) => {
    console.log('Fetching devices from Kandji API...');
    
    try {
        const data = await makeKandjiRequest(KANDJI_CONFIG.url, KANDJI_CONFIG.token);
        console.log(`Successfully fetched ${data.devices ? data.devices.length : 'unknown'} devices`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching from Kandji API:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch devices from Kandji API',
            message: error.message 
        });
    }
});

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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        kandjiUrl: KANDJI_CONFIG.url
    });
});

// Start the server
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