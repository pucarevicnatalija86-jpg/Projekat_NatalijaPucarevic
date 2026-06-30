/**
 * server.js
 * -----------------------------------------------------------------------
 * Entry point. Plain Node `http` server (no framework) serving:
 *   - the JSON API under /api/*  (auth, patients, admin)
 *   - the static frontend from /public at /
 *
 * Run with: node server.js   (or: npm start)
 */

'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');

require('./scripts/bootstrap-env').loadEnv();

const { Router } = require('./src/router');
const backup = require('./src/backup');

const authRoutes = require('./src/routes/authRoutes');
const patientRoutes = require('./src/routes/patientRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

function ensureSeeded() {
  const usersFile = path.join(DATA_DIR, 'users.json');
  if (!fs.existsSync(usersFile)) {
    console.log('Nema postojecih podataka — pokrecem inicijalno punjenje (seed)...');
    require('./scripts/seed');
  }
}

const router = new Router();
authRoutes.register(router);
patientRoutes.register(router);
adminRoutes.register(router);

ensureSeeded();

const server = http.createServer(router.handler(STATIC_DIR));

server.listen(PORT, () => {
  console.log('==================================================================');
  console.log(' Sistem za bezbedno upravljanje podacima o pacijentima');
  console.log(`  -> http://localhost:${PORT}`);
  console.log('==================================================================');

  const intervalMinutes = Number(process.env.BACKUP_INTERVAL_MINUTES) || 60;
  backup.startScheduledBackups(intervalMinutes, (folder) => {
    console.log(`[automatski backup] kreiran: ${folder}`);
  });
  console.log(`Automatski backup je zakazan na svakih ${intervalMinutes} minuta.`);
});

module.exports = server;
