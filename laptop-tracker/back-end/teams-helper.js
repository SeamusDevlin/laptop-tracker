const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const notifiedFile = path.join(__dirname, 'notified-devices.json');

// Load notified serials from file
function loadNotified() {
    try {
        return JSON.parse(fs.readFileSync(notifiedFile, 'utf8'));
    } catch {
        return [];
    }
}

// Save notified serials to file
function saveNotified(serials) {
    fs.writeFileSync(notifiedFile, JSON.stringify(serials, null, 2));
}

// Send Teams notification
async function sendTeamsNotification(webhookUrl, device) {
    const message = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": "Device Replacement Needed",
        "themeColor": "0076D7",
        "title": "Device Needs Replacement",
        "sections": [{
            "activityTitle": `💻 **${device.device_name || 'Unknown Device'}** needs replacement!`,
            "facts": [
                { "name": "User", "value": device.user?.name || 'Unknown' },
                { "name": "Model", "value": device.model || 'Unknown' },
                { "name": "Serial", "value": device.serial_number || 'Unknown' },
                { "name": "First Enrollment", "value": device.first_enrollment || 'Unknown' }
            ],
            "markdown": true
        }]
    };
    await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(message),
        headers: { 'Content-Type': 'application/json' }
    });
}

module.exports = { loadNotified, saveNotified, sendTeamsNotification };