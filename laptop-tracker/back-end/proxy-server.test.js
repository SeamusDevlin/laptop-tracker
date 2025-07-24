// Set env vars for Teams BEFORE requiring the app
process.env.TEAMS_NOTIFICATIONS_ENABLED = 'true';
process.env.TEAMS_WEBHOOK_URL = 'https://dummy.webhook';

const request = require('supertest');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const express = require('express');
const http = require('http');

// Mock device older than 4 years
const oldDevice = {
  serial_number: 'OLD123',
  first_enrollment: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365.25 * 5).toISOString()
};

// Mock teams-notifications module
const sendTeamsNotification = sinon.stub().resolves();
const loadNotified = sinon.stub().returns([]);
const saveNotified = sinon.stub();

const createApp = proxyquire('./proxy-server', {
  './teams-notifications': {
    sendTeamsNotification,
    loadNotified,
    saveNotified
  }
});

describe('Teams notification integration', function () {
  afterEach(() => {
    sinon.restore();
    sendTeamsNotification.resetHistory();
    loadNotified.resetHistory();
    saveNotified.resetHistory();
  });

  it('should send Teams notification for old device', async function () {
    // Create stub for makeKandjiRequest
    const makeKandjiRequest = sinon.stub().resolves({ devices: [oldDevice] });

    // Create app with stub injected
    const expressApp = createApp({ makeKandjiRequest });

    // Debugging output
    console.log('TEAMS_NOTIFICATIONS_ENABLED:', process.env.TEAMS_NOTIFICATIONS_ENABLED);
    console.log('TEAMS_WEBHOOK_URL:', process.env.TEAMS_WEBHOOK_URL);

    // Log expressApp type and keys for debugging
    console.log('typeof expressApp:', typeof expressApp);
    console.log('expressApp keys:', Object.keys(expressApp));

    const server = http.createServer(expressApp);

    // Debug: before request
    console.log('DEBUG: About to send GET /api/devices request');

    // Ensure server is closed after test to avoid hanging
    await request(server)
      .get('/api/devices')
      .expect(200);

    // Debug: after request
    console.log('DEBUG: Finished GET /api/devices request');

    server.close();

    // Debugging output
    console.log('sendTeamsNotification call count:', sendTeamsNotification.callCount);
    if (sendTeamsNotification.called) {
      console.log('sendTeamsNotification args:', sendTeamsNotification.getCall(0).args);
    } else {
      console.log('sendTeamsNotification was NOT called');
    }

    sinon.assert.calledOnce(sendTeamsNotification);
    sinon.assert.calledWith(sendTeamsNotification, 'https://dummy.webhook', oldDevice);
  });
});