const fs = require('fs');
const path = require('path');

// Simple file to store notified serials
const NOTIFIED_FILE = path.join(__dirname, 'notified.json');

function loadNotified() {
    try {
        if (fs.existsSync(NOTIFIED_FILE)) {
            return JSON.parse(fs.readFileSync(NOTIFIED_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading notified.json:', e);
    }
    return [];
}

function saveNotified(serials) {
    try {
        fs.writeFileSync(NOTIFIED_FILE, JSON.stringify(serials, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing notified.json:', e);
    }
}

async function sendTeamsNotification(webhookUrl, device) {
    // Stub: Replace with actual Teams webhook logic
    console.log(`(Stub) Would send Teams notification for device: ${device.serial_number}`);
    return Promise.resolve();
}

module.exports = {
    loadNotified,
    saveNotified,
    sendTeamsNotification
};
