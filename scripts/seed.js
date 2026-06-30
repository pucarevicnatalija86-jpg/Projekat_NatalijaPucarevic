/**
 * scripts/seed.js
 * -----------------------------------------------------------------------
 * Resets /data to a small, known demo state:
 *   - 1 administrator account
 *   - 1 lekar (doctor) account
 *   - 2 sample patients (their jmbg/dijagnoza will be stored encrypted)
 *   - an empty audit log
 *
 * Run with: node scripts/seed.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

require('./bootstrap-env').loadEnv();

const { hashPassword } = require('../src/auth');
const { encryptField } = require('../src/crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');

const ADMIN_PASSWORD = 'Admin#2026';
const LEKAR_PASSWORD = 'Lekar#2026';

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const users = [
    { id: 1, username: 'admin', passwordHash: hashPassword(ADMIN_PASSWORD), role: 'administrator', createdAt: new Date().toISOString() },
    { id: 2, username: 'lekar', passwordHash: hashPassword(LEKAR_PASSWORD), role: 'lekar', createdAt: new Date().toISOString() },
  ];
  fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));

  const now = new Date().toISOString();
  const patients = [
    {
      id: 1,
      ime: 'Marko',
      prezime: 'Markovic',
      datumRodjenja: '1990-04-12',
      telefon: '060-111-2233',
      jmbg: encryptField('0204990710017'),
      dijagnoza: encryptField('Sezonska alergija (J30.1)'),
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed',
    },
    {
      id: 2,
      ime: 'Ana',
      prezime: 'Petrovic',
      datumRodjenja: '1985-09-23',
      telefon: '064-555-7788',
      jmbg: encryptField('2309985715029'),
      dijagnoza: encryptField('Hipertenzija (I10)'),
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed',
    },
  ];
  fs.writeFileSync(path.join(DATA_DIR, 'patients.json'), JSON.stringify(patients, null, 2));

  fs.writeFileSync(path.join(DATA_DIR, 'audit-log.json'), JSON.stringify([], null, 2));

  console.log('Demo podaci su uspesno kreirani.\n');
  console.log('Nalozi za prijavu:');
  console.log(`  administrator -> username: admin   lozinka: ${ADMIN_PASSWORD}`);
  console.log(`  lekar         -> username: lekar   lozinka: ${LEKAR_PASSWORD}`);
}

main();
