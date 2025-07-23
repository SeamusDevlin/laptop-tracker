// API Configuration - hardcoded for auto-updates
const API_CONFIG = {
    url: 'http://localhost:3001/api/devices', // Proxy server URL
    kandjiUrl: 'https://brightsg.api.eu.kandji.io/api/v1/devices', // Original Kandji API URL (not directly used by frontend after proxy)
    token: '62ee6dcd-886e-4949-a3ac-2ce0b2709c7e' // Token (handled by proxy, but kept for context)
};

let devicesData = [];
let currentFilter = 'all';
let currentSearch = '';
let autoRefreshInterval;

// Auto-fetch on page load
document.addEventListener('DOMContentLoaded', function() {
    fetchDevices();
    startAutoRefresh();
    setupFilterButtons();
    setupSearch();
});

function startAutoRefresh() {
    // Refresh every 5 minutes
    autoRefreshInterval = setInterval(fetchDevices, 5 * 60 * 1000);
}

function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
}

function getInitials(name) {
    if (!name || typeof name !== 'string') {
        return '??';
    }
    return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
}

function calculateDeviceAge(enrollmentDate) {
    const enrollment = new Date(enrollmentDate);
    const now = new Date();
    const diffTime = Math.abs(now - enrollment);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    return diffYears;
}

function getAgeCategory(years) {
    if (years >= 4) return 'danger';
    if (years >= 3) return 'warning';
    return 'good';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function renderDeviceItem(device) {
    // Safely handle missing data
    const user = device.user || {};
    const userName = user.name || 'Unknown User';
    const userEmail = user.email || 'No email';
    const deviceName = device.device_name || 'Unknown Device';
    const model = device.model || 'Unknown Model';
    const osVersion = device.os_version || 'Unknown OS';
    const serialNumber = device.serial_number || 'Unknown Serial';
    const assetTag = device.asset_tag || 'N/A'; // Although not used in render, good to keep in mind
    const lastEnrollment = device.last_enrollment || device.last_check_in || new Date().toISOString();
    const firstEnrollment = device.first_enrollment || lastEnrollment;
    
    const age = calculateDeviceAge(firstEnrollment);
    const ageCategory = getAgeCategory(age);
    const initials = getInitials(userName);
    
    let itemClass = 'device-item';
    if (ageCategory === 'danger') itemClass += ' needs-replacement';
    else if (ageCategory === 'warning') itemClass += ' warning';
    else itemClass += ' good';

    let ageBubbleClass = 'age-bubble ';
    let ageText = '';
    if (ageCategory === 'danger') {
        ageBubbleClass += 'age-danger';
        ageText = 'REPLACE NOW';
    } else if (ageCategory === 'warning') {
        ageBubbleClass += 'age-warning';
        ageText = 'MONITOR';
    } else {
        ageBubbleClass += 'age-good';
        ageText = 'GOOD';
    }

    // Apply search highlighting
    const highlightedDeviceName = highlightSearchTerm(deviceName, currentSearch);
    const highlightedUserName = highlightSearchTerm(userName, currentSearch);
    const highlightedUserEmail = highlightSearchTerm(userEmail, currentSearch);
    const highlightedModel = highlightSearchTerm(model, currentSearch);
    const highlightedSerial = highlightSearchTerm(serialNumber, currentSearch);

    return `
        <div class="${itemClass}" data-category="${ageCategory}">
            <div class="device-avatar">${initials}</div>
            
            <div class="device-info">
                <div class="device-main">
                    <div class="device-name">${highlightedDeviceName}</div>
                    <div class="device-user">${highlightedUserName} • ${highlightedUserEmail}</div>
                    <div class="device-model">${highlightedModel}</div>
                </div>
                
                <div class="device-detail">
                    <div class="detail-label">OS Version</div>
                    <div class="detail-value">${osVersion}</div>
                </div>
                
                <div class="device-detail">
                    <div class="detail-label">Serial Number</div>
                    <div class="detail-value">${highlightedSerial}</div>
                </div>
                
                <div class="age-status">
                    <div class="${ageBubbleClass}">${ageText}</div>
                    <div class="age-years">${age.toFixed(1)} years</div>
                </div>
            </div>
        </div>
    `;
}

function updateStats() {
    const stats = {
        total: devicesData.length,
        replacement: devicesData.filter(d => {
            const firstEnrollment = d.first_enrollment || d.last_enrollment || d.last_check_in || new Date().toISOString();
            return calculateDeviceAge(firstEnrollment) >= 4;
        }).length,
        warning: devicesData.filter(d => {
            const firstEnrollment = d.first_enrollment || d.last_enrollment || d.last_check_in || new Date().toISOString();
            const age = calculateDeviceAge(firstEnrollment);
            return age >= 3 && age < 4;
        }).length,
        good: devicesData.filter(d => {
            const firstEnrollment = d.first_enrollment || d.last_enrollment || d.last_check_in || new Date().toISOString();
            return calculateDeviceAge(firstEnrollment) < 3;
        }).length
    };

    document.getElementById('totalDevices').textContent = stats.total;
    document.getElementById('needsReplacement').textContent = stats.replacement;
    document.getElementById('warningDevices').textContent = stats.warning;
    document.getElementById('goodDevices').textContent = stats.good;
}

function matchesSearch(device, searchTerm) {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const user = device.user || {};
    const userName = (user.name || '').toLowerCase();
    const userEmail = (user.email || '').toLowerCase();
    const deviceName = (device.device_name || '').toLowerCase();
    const model = (device.model || '').toLowerCase();
    const serialNumber = (device.serial_number || '').toLowerCase();
    
    return userName.includes(searchLower) ||
           userEmail.includes(searchLower) ||
           deviceName.includes(searchLower) ||
           model.includes(searchLower) ||
           serialNumber.includes(searchLower);
}

function renderDevices() {
    const content = document.getElementById('content');
    
    if (devicesData.length === 0) {
        content.innerHTML = '<div class="empty-state"><h3>No devices found</h3><p>Try adjusting your filters or check your API configuration.</p></div>';
        return;
    }

    let filteredDevices = devicesData;
    
    // Apply search filter
    if (currentSearch) {
        filteredDevices = filteredDevices.filter(device => matchesSearch(device, currentSearch));
    }
    
    // Apply category filter
    if (currentFilter === 'replacement') {
        filteredDevices = filteredDevices.filter(d => {
            const firstEnrollment = d.first_enrollment || d.last_enrollment || d.last_check_in || new Date().toISOString();
            return calculateDeviceAge(firstEnrollment) >= 4;
        });
    } else if (currentFilter === 'warning') {
        filteredDevices = filteredDevices.filter(d => {
            const firstEnrollment = d.first_enrollment || d.last_enrollment || d.last_check_in || new Date().toISOString();
            const age = calculateDeviceAge(firstEnrollment);
            return age >= 3 && age < 4;
        });
    } else if (currentFilter === 'good') {
        filteredDevices = filteredDevices.filter(d => {
            const firstEnrollment = d.first_enrollment || d.last_enrollment || d.last_check_in || new Date().toISOString();
            return calculateDeviceAge(firstEnrollment) < 3;
        });
    }

    // Sort by age (oldest first based on first enrollment)
    filteredDevices.sort((a, b) => {
        const firstEnrollmentA = a.first_enrollment || a.last_enrollment || a.last_check_in || new Date().toISOString();
        const firstEnrollmentB = b.first_enrollment || b.last_enrollment || b.last_check_in || new Date().toISOString();
        const ageA = calculateDeviceAge(firstEnrollmentA);
        const ageB = calculateDeviceAge(firstEnrollmentB);
        return ageB - ageA;
    });

    if (filteredDevices.length === 0) {
        const searchMessage = currentSearch ? `No devices found matching "${currentSearch}"` : 'No devices found';
        content.innerHTML = `<div class="empty-state"><h3>${searchMessage}</h3><p>Try adjusting your search or filters.</p></div>`;
        return;
    }

    content.innerHTML = `
        <div class="device-list">
            ${filteredDevices.map(device => renderDeviceItem(device)).join('')}
        </div>
    `;
}

function filterDevices(filter, clickedButton) {
    currentFilter = filter;
    
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    clickedButton.classList.add('active');
    
    renderDevices();
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', function() {
        currentSearch = this.value.trim();
        
        if (currentSearch) {
            clearSearch.classList.remove('hidden');
        } else {
            clearSearch.classList.add('hidden');
        }
        
        renderDevices();
    });
    
    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        currentSearch = '';
        this.classList.add('hidden');
        renderDevices();
        searchInput.focus();
    });
}

async function fetchDevices() {
    const content = document.getElementById('content');

    // Show loading only if no data exists
    if (devicesData.length === 0) {
        content.innerHTML = '<div class="loading">🔄 Loading devices...</div>';
    }

    try {
        const response = await fetch(API_CONFIG.url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw API response:', data);
        
        // Handle different response structures from the proxy
        let devices = [];
        if (Array.isArray(data)) {
            devices = data;
        } else if (data.devices && Array.isArray(data.devices)) {
            devices = data.devices;
        } else if (data.results && Array.isArray(data.results)) {
            devices = data.results;
        } else {
            console.warn('Unexpected data structure:', data);
            devices = [];
        }

        devicesData = devices;
        console.log('Processed devices:', devicesData.length);
        
        document.getElementById('stats').style.display = 'grid';
        document.getElementById('filtersContainer').style.display = 'flex';
        
        updateStats();
        renderDevices();
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Fetch error:', error);
        const errorMessage = `
            <div class="error">
                <strong>❌ Error fetching devices:</strong> ${error.message}
                <br><br>
                <strong>Setup Required:</strong> You need to run the proxy server first.
                <br><br>
                <strong>Quick Setup:</strong>
                <ol>
                    <li>Save the proxy server code as <code>proxy-server.js</code></li>
                    <li>Run: <code>npm install express cors node-fetch</code></li>
                    <li>Run: <code>node proxy-server.js</code></li>
                    <li>Refresh this page</li>
                </ol>
            </div>
        `;
        content.innerHTML = errorMessage;
    }
}

// The filterButtons setup needs to be called after the buttons are rendered (which is on DOMContentLoaded)
// and now expects the button element to be passed, consistent with the inline onclick.
// This function is still needed to ensure the initial 'active' class is set correctly on load if needed,
// but the primary filter logic is now handled by the onclick in the HTML passing 'this'.
function setupFilterButtons() {
    // No specific setup needed here anymore for event listeners as they are inline.
    // This function can be simplified or removed if not setting initial states.
}