/**
 * audit.js
 * -----------------------------------------------------------------------
 * "Vodjenje evidencije aktivnosti korisnika" — records EVERY data access:
 * creation, modification, deletion AND reads ("citanje podataka iz baze
 * i ko je korisnik"), plus auth events. This module is the only writer
 * of audit-log.json; entries are append-only (the API never exposes an
 * endpoint to edit or delete a log entry, including for administrators —
 * an audit trail that can be edited by the people it watches is not a
 * meaningful control).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, '..', 'data', 'audit-log.json');

function readLog() {
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const raw = fs.readFileSync(AUDIT_FILE, 'utf8').trim();
  return raw ? JSON.parse(raw) : [];
}

function writeLog(entries) {
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

/**
 * @param {object} p
 * @param {string} p.username
 * @param {string} p.role
 * @param {string} p.action     LOGIN | LOGIN_FAILED | CREATE | READ | READ_LIST | UPDATE | DELETE | BACKUP | RESTORE | CREATE_USER
 * @param {string} p.resource    'patient' | 'user' | 'auth' | 'system'
 * @param {string|number|null} p.resourceId
 * @param {string} [p.details]
 * @param {string} [p.ip]
 */
function record({ username, role, action, resource, resourceId = null, details = '', ip = '' }) {
  const entries = readLog();
  entries.push({
    id: entries.length ? entries[entries.length - 1].id + 1 : 1,
    timestamp: new Date().toISOString(),
    username,
    role,
    action,
    resource,
    resourceId,
    details,
    ip,
  });
  writeLog(entries);
}

function getAll() {
  // newest first, easiest to review in the admin UI
  return readLog().slice().reverse();
}

module.exports = { record, getAll, AUDIT_FILE };
