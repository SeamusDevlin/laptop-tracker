const API_CONFIG = {
    windowsUrl: 'http://localhost:3001/api/windows-devices'
};

let devicesData = [];
let currentFilter = 'all';
let currentSearch = '';
let autoRefreshInterval;

document.addEventListener('DOMContentLoaded', function() {
    fetchWindowsDevices();
    startAutoRefresh();
    setupFilterButtons();
    setupSearch();
});

function startAutoRefresh() {
    autoRefreshInterval = setInterval(fetchWindowsDevices, 5 * 60 * 1000);
}

function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
}

function getInitials(name) {
    if (!name || typeof name !== 'string') return '??';
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

function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !text) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function renderDeviceItem(device) {
    const user = device.user || {};
    const userName = user.name || 'Unknown User';
    const userEmail = user.email || 'No email';
    const deviceName = device.device_name || 'Unknown Device';
    const model = device.model || 'Unknown Model';
    const osVersion = device.os_version || 'Unknown OS';
    const serialNumber = device.serial_number || 'Unknown Serial';
    const assetTag = device.asset_tag || 'N/A';
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
    if (currentSearch) {
        filteredDevices = filteredDevices.filter(device => matchesSearch(device, currentSearch));
    }
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

async function fetchWindowsDevices() {
    const content = document.getElementById('content');
    if (devicesData.length === 0) {
        content.innerHTML = '<div class="loading">🔄 Loading devices...</div>';
    }
    try {
        const winResponse = await fetch(API_CONFIG.windowsUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!winResponse.ok) {
            let errorMsg = `Windows HTTP error! status: ${winResponse.status}`;
            let errorData = {};
            try {
                errorData = await winResponse.json();
            } catch (e) {
                errorMsg += '<br><br>Unable to parse error response.';
            }
            if (errorData && errorData.message) {
                errorMsg += `<br><br><strong>Backend message:</strong> ${errorData.message}`;
                // If backend message is a JSON string, pretty print it
                try {
                    const parsedMsg = JSON.parse(errorData.message);
                    errorMsg += `<br><br><strong>Backend message (parsed):</strong><pre>${JSON.stringify(parsedMsg, null, 2)}</pre>`;
                } catch (e) {
                    // Not JSON, just show as is
                }
            }
            if (errorData && errorData.hint) {
                errorMsg += `<br><br><strong>Hint:</strong> ${errorData.hint}`;
            }
            errorMsg += `<br><br><strong>Raw error response:</strong><pre>${JSON.stringify(errorData, null, 2)}</pre>`;
            throw new Error(errorMsg);
        }
        const winData = await winResponse.json();
        console.log('Raw Windows API response:', winData);

        let windowsDevices = [];
        if (Array.isArray(winData)) {
            windowsDevices = winData;
        } else if (winData.devices && Array.isArray(winData.devices)) {
            windowsDevices = winData.devices;
        } else if (winData.results && Array.isArray(winData.results)) {
            windowsDevices = winData.results;
        } else if (winData.value && Array.isArray(winData.value)) {
            windowsDevices = winData.value;
        } else {
            windowsDevices = [];
        }

        console.log('Processed Windows devices:', windowsDevices.length, windowsDevices);

        devicesData = windowsDevices;
        document.getElementById('stats').style.display = 'grid';
        document.getElementById('filtersContainer').style.display = 'flex';
        updateStats();
        renderDevices();
        updateLastUpdateTime();
    } catch (error) {
        console.error('Fetch error:', error);
        const errorMessage = `
            <div class="error">
                <strong>❌ Error fetching Windows devices:</strong> ${error.message}
                <br><br>
                <strong>Possible Cause:</strong> If you have already granted permissions, double-check:</strong>
                <ul>
                    <li>Token is for the correct tenant and app registration</li>
                    <li>API permissions are <code>DeviceManagementManagedDevices.Read.All</code> (Application type)</li>
                    <li>Admin consent is shown as "Granted"</li>
                    <li>Your account has access to Intune and devices exist</li>
                </ul>
                <strong>Raw backend error response is shown above for troubleshooting.</strong>
            </div>
        `;
        content.innerHTML = errorMessage;
    }
}

function setupFilterButtons() {
    // No specific setup needed here anymore for event listeners as they are inline.
}
