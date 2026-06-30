/**
 * scripts/demo.js
 * -----------------------------------------------------------------------
 * "Demonstrirati primenu navedenih mehanizama" — a runnable, scripted
 * walkthrough that exercises every mechanism required by the assignment
 * against a REAL running instance of the server, and prints what
 * happened at each step. Uses Node's built-in global `fetch` (Node 18+)
 * — no extra dependency needed.
 *
 * Usage:
 *   1. node server.js        (in one terminal)
 *   2. node scripts/demo.js  (in another terminal)
 */

'use strict';

const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3000';

function log(line) { console.log(line); }
function header(title) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  header('1) AUTENTIFIKACIJA — prijava lekara i administratora');
  const lekarLogin = await call('POST', '/api/auth/login', null, { username: 'lekar', password: 'Lekar#2026' });
  log(`Prijava (lekar)        -> HTTP ${lekarLogin.status}, token izdat: ${!!lekarLogin.data.token}`);
  const adminLogin = await call('POST', '/api/auth/login', null, { username: 'admin', password: 'Admin#2026' });
  log(`Prijava (administrator)-> HTTP ${adminLogin.status}, token izdat: ${!!adminLogin.data.token}`);

  const badLogin = await call('POST', '/api/auth/login', null, { username: 'lekar', password: 'pogresna' });
  log(`Prijava sa pogresnom lozinkom -> HTTP ${badLogin.status} (${badLogin.data.error})`);

  if (!lekarLogin.data.token || !adminLogin.data.token) {
    console.error('\nServer nije dostupan na ' + BASE + ' ili seed podaci nisu ucitani. Pokrenite "node server.js" prvo.');
    process.exit(1);
  }
  const lekarToken = lekarLogin.data.token;
  const adminToken = adminLogin.data.token;

  header('2) RBAC + CRUD — lekar kreira i cita karton (ENKRIPCIJA u pozadini)');
  const created = await call('POST', '/api/patients', lekarToken, {
    ime: 'Demo', prezime: 'Pacijent', datumRodjenja: '2000-01-01',
    telefon: '060-000-0000', jmbg: '0101000700017', dijagnoza: 'Test dijagnoza (demo)',
  });
  log(`Kreiranje pacijenta (lekar) -> HTTP ${created.status}, id=${created.data.patient && created.data.patient.id}`);
  const newId = created.data.patient.id;

  const list = await call('GET', '/api/patients', lekarToken);
  log(`Citanje liste pacijenata (lekar) -> HTTP ${list.status}, ${list.data.patients.length} zapisa (citanje je upravo upisano u audit log)`);

  header('3) RBAC — lekar POKUSAVA da obrise karton (mora biti odbijeno)');
  const deniedDelete = await call('DELETE', `/api/patients/${newId}`, lekarToken);
  log(`DELETE kao lekar -> HTTP ${deniedDelete.status} (${deniedDelete.data.error})`);
  log(deniedDelete.status === 403 ? '   ✓ RBAC je ispravno blokirao akciju.' : '   ✗ NEOCEKIVANO: akcija nije blokirana!');

  header('4) RBAC — administrator MOZE da obrise karton');
  const allowedDelete = await call('DELETE', `/api/patients/${newId}`, adminToken);
  log(`DELETE kao administrator -> HTTP ${allowedDelete.status}`);

  header('5) ENKRIPCIJA — sirovi sadrzaj data/patients.json (sa diska)');
  const fs = require('fs');
  const path = require('path');
  const rawPatients = fs.readFileSync(path.join(__dirname, '..', 'data', 'patients.json'), 'utf8');
  const sample = JSON.parse(rawPatients)[0];
  if (sample) {
    log('Primer zapisa NA DISKU (ono sto bi video napadac sa pristupom fajlu):');
    log(`   jmbg:      ${sample.jmbg}`);
    log(`   dijagnoza: ${sample.dijagnoza}`);
    log('   (oba polja su AES-256-GCM ciphertext, ne citljiv tekst)');
  }

  header('6) EVIDENCIJA AKTIVNOSTI — poslednjih nekoliko zapisa iz audit loga');
  const auditLog = await call('GET', '/api/admin/audit-log', adminToken);
  auditLog.data.entries.slice(0, 8).forEach((e) => {
    log(`   [${e.timestamp}] ${e.username} (${e.role}) -> ${e.action} ${e.resource}${e.resourceId ? '#' + e.resourceId : ''}`);
  });

  header('7) RBAC — lekar NE MOZE da vidi audit log (samo administrator)');
  const deniedAudit = await call('GET', '/api/admin/audit-log', lekarToken);
  log(`GET /api/admin/audit-log kao lekar -> HTTP ${deniedAudit.status} (${deniedAudit.data.error})`);

  header('8) BACKUP & RECOVERY — rucni backup, pa simulacija gubitka podataka, pa oporavak');
  const backupRes = await call('POST', '/api/admin/backups', adminToken);
  log(`Kreiran backup -> ${backupRes.data.backup}`);

  const beforeRestore = await call('GET', '/api/patients', adminToken);
  log(`Broj pacijenata PRE simulacije gubitka: ${beforeRestore.data.patients.length}`);

  // Simulate data loss/corruption.
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'patients.json'), '[]');
  const afterLoss = await call('GET', '/api/patients', adminToken);
  log(`Broj pacijenata NAKON simuliranog gubitka (fajl obrisan/oštecen): ${afterLoss.data.patients.length}`);

  const restoreRes = await call('POST', '/api/admin/restore', adminToken, { backupName: backupRes.data.backup });
  log(`Oporavak iz backupa "${backupRes.data.backup}" -> HTTP ${restoreRes.status}`);

  const afterRestore = await call('GET', '/api/patients', adminToken);
  log(`Broj pacijenata NAKON oporavka: ${afterRestore.data.patients.length}`);
  log(afterRestore.data.patients.length === beforeRestore.data.patients.length
    ? '   ✓ Sistem je uspesno oporavljen iz rezervne kopije.'
    : '   ✗ NEOCEKIVANO: broj zapisa se ne poklapa.');

  header('Demonstracija zavrsena.');
  log('Pokrenite "node scripts/demo.js > demo-izlaz.txt" da sacuvate ovaj izlaz za seminarski rad.\n');
}

main().catch((err) => {
  console.error('Demo skripta je naisla na gresku:', err.message);
  process.exit(1);
});
