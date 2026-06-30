/**
 * backup.js
 * -----------------------------------------------------------------------
 * "Mehanizmi za redovno kreiranje rezervnih kopija (backup) baze podataka
 * i omogucavanje oporavka sistema iz backup fajlova u slucaju gubitka ili
 * ostecenja podataka (uloga administratora)."
 *
 * A backup is a timestamped snapshot of every file in /data (users,
 * patients — still encrypted, since we copy the raw files — and the
 * audit log itself, so an investigation after an incident is also
 * recoverable). Snapshots are taken:
 *   1. On a fixed schedule while the server is running ("redovno") — see
 *      startScheduledBackups(), driven by BACKUP_INTERVAL_MINUTES in .env.
 *   2. On demand by an administrator (POST /api/admin/backup).
 *
 * Restore is administrator-only and is itself audited (see adminRoutes.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const FILES_TO_BACKUP = ['users.json', 'patients.json', 'audit-log.json'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Creates backups/<timestamp>/{users,patients,audit-log}.json. Returns the folder name. */
function createBackup() {
  ensureDir(BACKUPS_DIR);
  const folderName = `backup-${timestampSlug()}`;
  const dest = path.join(BACKUPS_DIR, folderName);
  ensureDir(dest);

  for (const file of FILES_TO_BACKUP) {
    const src = path.join(DATA_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dest, file));
    }
  }
  return folderName;
}

function listBackups() {
  ensureDir(BACKUPS_DIR);
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((name) => fs.statSync(path.join(BACKUPS_DIR, name)).isDirectory())
    .sort()
    .reverse(); // newest first
}

/** Restores /data from backups/<folderName>. Throws if the folder doesn't exist. */
function restoreBackup(folderName) {
  const src = path.join(BACKUPS_DIR, folderName);
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    throw new Error(`Backup "${folderName}" ne postoji.`);
  }
  // Safety snapshot of the CURRENT (possibly damaged) state before we
  // overwrite it, so a bad restore is itself recoverable.
  const safetyFolder = createBackup();

  for (const file of FILES_TO_BACKUP) {
    const from = path.join(src, file);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(DATA_DIR, file));
    }
  }
  return safetyFolder;
}

let scheduledTimer = null;

/** Starts the "redovno kreiranje rezervnih kopija" interval. Returns the timer for tests. */
function startScheduledBackups(intervalMinutes, onBackup) {
  if (scheduledTimer) clearInterval(scheduledTimer);
  const ms = Math.max(1, Number(intervalMinutes) || 60) * 60 * 1000;
  scheduledTimer = setInterval(() => {
    const folder = createBackup();
    if (typeof onBackup === 'function') onBackup(folder);
  }, ms);
  return scheduledTimer;
}

module.exports = { createBackup, listBackups, restoreBackup, startScheduledBackups, BACKUPS_DIR };
