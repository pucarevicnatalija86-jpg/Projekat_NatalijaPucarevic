/**
 * db.js
 * -----------------------------------------------------------------------
 * Minimal data-access layer. Data is stored in JSON files under /data
 * instead of a full RDBMS — appropriate for a teaching-scale "jednostavna
 * CRUD aplikacija" and it keeps the project dependency-free. All access
 * goes through this module, so it is the ONE place that knows about the
 * on-disk format and the ONE place that calls the encryption layer; the
 * routes never see ciphertext or handle keys directly (separation of
 * concerns reduces the chance of a route accidentally leaking plaintext
 * or accidentally storing a field unencrypted).
 *
 * DATA MINIMIZATION ("minimizacija podataka"): the Patient record below
 * lists every field this system collects. Anything not listed here
 * (e.g. address, employer, financial data, full medical history) is
 * deliberately NOT collected, because it is not necessary for the
 * stated purpose of the system (identifying a patient and recording the
 * clinically relevant diagnosis). See README "Minimizacija podataka".
 *
 * SENSITIVE FIELDS (encrypted at rest via src/crypto.js):
 *   - jmbg      -> unique national ID number, directly identifying
 *   - dijagnoza -> health data ("posebna kategorija podataka" / special
 *                  category of personal data under both the GDPR and the
 *                  Serbian Zakon o zastiti podataka o licnosti)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { encryptField, decryptField } = require('./crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8').trim();
  return raw ? JSON.parse(raw) : [];
}

function writeJson(file, data) {
  // Pretty-printed on purpose: this is a teaching project and the data
  // files are meant to be human-inspectable (e.g. to SEE that jmbg/
  // dijagnoza are stored as ciphertext, not plaintext).
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function nextId(records) {
  return records.length ? Math.max(...records.map((r) => r.id)) + 1 : 1;
}

/* ------------------------------- USERS -------------------------------- */

function getAllUsers() {
  return readJson(USERS_FILE);
}

function findUserByUsername(username) {
  return getAllUsers().find((u) => u.username.toLowerCase() === String(username).toLowerCase());
}

function createUser({ username, passwordHash, role }) {
  const users = getAllUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Korisnicko ime vec postoji.');
  }
  const user = {
    id: nextId(users),
    username,
    passwordHash,
    role, // 'administrator' | 'lekar'
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeJson(USERS_FILE, users);
  return user;
}

function listUsersSafe() {
  // Never return passwordHash to any API consumer.
  return getAllUsers().map(({ passwordHash, ...safe }) => safe);
}

/* ------------------------------ PATIENTS ------------------------------ */

const SENSITIVE_PATIENT_FIELDS = ['jmbg', 'dijagnoza'];

function encryptPatient(plain) {
  const record = { ...plain };
  for (const field of SENSITIVE_PATIENT_FIELDS) {
    if (field in record) record[field] = encryptField(record[field]);
  }
  return record;
}

function decryptPatient(stored) {
  if (!stored) return stored;
  const record = { ...stored };
  for (const field of SENSITIVE_PATIENT_FIELDS) {
    if (field in record) {
      try {
        record[field] = decryptField(record[field]);
      } catch (e) {
        record[field] = '[GRESKA PRI DESIFROVANJU]';
      }
    }
  }
  return record;
}

function getAllPatientsDecrypted() {
  return readJson(PATIENTS_FILE).map(decryptPatient);
}

function getPatientByIdDecrypted(id) {
  const found = readJson(PATIENTS_FILE).find((p) => p.id === Number(id));
  return found ? decryptPatient(found) : null;
}

function createPatient(plainFields, username) {
  const patients = readJson(PATIENTS_FILE);
  const now = new Date().toISOString();
  const plain = {
    id: nextId(patients),
    ime: plainFields.ime,
    prezime: plainFields.prezime,
    datumRodjenja: plainFields.datumRodjenja || null,
    telefon: plainFields.telefon || null,
    jmbg: plainFields.jmbg || null,
    dijagnoza: plainFields.dijagnoza || null,
    createdAt: now,
    updatedAt: now,
    createdBy: username,
  };
  patients.push(encryptPatient(plain));
  writeJson(PATIENTS_FILE, patients);
  return decryptPatient(plain);
}

function updatePatient(id, plainFields, username) {
  const patients = readJson(PATIENTS_FILE);
  const idx = patients.findIndex((p) => p.id === Number(id));
  if (idx === -1) return null;

  const current = decryptPatient(patients[idx]);
  const updated = {
    ...current,
    ...plainFields,
    id: current.id,
    createdAt: current.createdAt,
    createdBy: current.createdBy,
    updatedAt: new Date().toISOString(),
    updatedBy: username,
  };
  patients[idx] = encryptPatient(updated);
  writeJson(PATIENTS_FILE, patients);
  return decryptPatient(patients[idx]);
}

function deletePatient(id) {
  const patients = readJson(PATIENTS_FILE);
  const idx = patients.findIndex((p) => p.id === Number(id));
  if (idx === -1) return false;
  patients.splice(idx, 1);
  writeJson(PATIENTS_FILE, patients);
  return true;
}

module.exports = {
  DATA_DIR,
  USERS_FILE,
  PATIENTS_FILE,
  readJson,
  writeJson,
  getAllUsers,
  findUserByUsername,
  createUser,
  listUsersSafe,
  getAllPatientsDecrypted,
  getPatientByIdDecrypted,
  createPatient,
  updatePatient,
  deletePatient,
};
