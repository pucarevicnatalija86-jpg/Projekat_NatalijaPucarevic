/**
 * routes/adminRoutes.js
 * -----------------------------------------------------------------------
 * Everything here requires the 'administrator' role:
 *   GET  /api/admin/audit-log     - full audit trail
 *   GET  /api/admin/backups       - list available backup snapshots
 *   POST /api/admin/backups       - trigger an on-demand backup
 *   POST /api/admin/restore       - restore /data from a chosen backup
 *   GET  /api/admin/users         - list users (without password hashes)
 *   POST /api/admin/users         - create a new user account
 */

'use strict';

const { sendJson } = require('../router');
const db = require('../db');
const audit = require('../audit');
const backup = require('../backup');
const { hashPassword } = require('../auth');
const { requireAuth, requireRole } = require('../middleware');

const VALID_ROLES = ['administrator', 'lekar'];

function register(router) {
  router.get('/api/admin/audit-log', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator'])) return;
    sendJson(res, 200, { entries: audit.getAll() });
  });

  router.get('/api/admin/backups', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator'])) return;
    sendJson(res, 200, { backups: backup.listBackups() });
  });

  router.post('/api/admin/backups', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator'])) return;

    const folder = backup.createBackup();

    audit.record({
      username: user.username,
      role: user.role,
      action: 'BACKUP',
      resource: 'system',
      details: `Rucno kreiran backup: ${folder}`,
      ip: req.socket.remoteAddress || '',
    });

    sendJson(res, 201, { backup: folder });
  });

  router.post('/api/admin/restore', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator'])) return;

    const { backupName } = req.body || {};
    if (!backupName) {
      sendJson(res, 400, { error: 'Polje "backupName" je obavezno (vidi GET /api/admin/backups).' });
      return;
    }

    try {
      const safetyFolder = backup.restoreBackup(backupName);
      audit.record({
        username: user.username,
        role: user.role,
        action: 'RESTORE',
        resource: 'system',
        details: `Sistem vracen iz backupa "${backupName}". Stanje pre vracanja sacuvano u "${safetyFolder}".`,
        ip: req.socket.remoteAddress || '',
      });
      sendJson(res, 200, { restored: backupName, safetyBackup: safetyFolder });
    } catch (err) {
      sendJson(res, 404, { error: err.message });
    }
  });

  router.get('/api/admin/users', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator'])) return;
    sendJson(res, 200, { users: db.listUsersSafe() });
  });

  router.post('/api/admin/users', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator'])) return;

    const { username, password, role } = req.body || {};
    if (!username || !password || !role) {
      sendJson(res, 400, { error: 'Polja "username", "password" i "role" su obavezna.' });
      return;
    }
    if (!VALID_ROLES.includes(role)) {
      sendJson(res, 400, { error: `Uloga mora biti jedna od: ${VALID_ROLES.join(', ')}.` });
      return;
    }
    if (String(password).length < 6) {
      sendJson(res, 400, { error: 'Lozinka mora imati najmanje 6 karaktera.' });
      return;
    }

    try {
      const newUser = db.createUser({ username, passwordHash: hashPassword(password), role });
      audit.record({
        username: user.username,
        role: user.role,
        action: 'CREATE_USER',
        resource: 'user',
        resourceId: newUser.id,
        details: `Kreiran novi korisnicki nalog "${newUser.username}" sa ulogom "${newUser.role}".`,
        ip: req.socket.remoteAddress || '',
      });
      sendJson(res, 201, { user: { id: newUser.id, username: newUser.username, role: newUser.role } });
    } catch (err) {
      sendJson(res, 409, { error: err.message });
    }
  });
}

module.exports = { register };
