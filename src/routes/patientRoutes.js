/**
 * routes/patientRoutes.js
 * -----------------------------------------------------------------------
 * CRUD on the Patient resource. RBAC ("kontrola pristupa") is granular,
 * not all-or-nothing:
 *
 *   GET/POST/PUT  -> administrator OR lekar
 *   DELETE        -> administrator ONLY (principle of least privilege —
 *                    a doctor can correct a record but cannot permanently
 *                    erase patient history)
 *
 * Every single action — including plain reads — is written to the audit
 * log ("citanje podataka iz baze i ko je korisnik"), and patient input is
 * whitelisted to exactly the fields defined in db.js (data minimization
 * enforced at the API boundary, not just "by convention").
 */

'use strict';

const { sendJson } = require('../router');
const db = require('../db');
const audit = require('../audit');
const { requireAuth, requireRole } = require('../middleware');

const ALLOWED_FIELDS = ['ime', 'prezime', 'datumRodjenja', 'telefon', 'jmbg', 'dijagnoza'];

function pickAllowedFields(body) {
  const out = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

function validateRequired(fields) {
  if (!fields.ime || !fields.prezime) {
    return 'Polja "ime" i "prezime" su obavezna.';
  }
  return null;
}

function register(router) {
  // ---- LIST (READ_LIST) ----
  router.get('/api/patients', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator', 'lekar'])) return;

    const patients = db.getAllPatientsDecrypted();

    audit.record({
      username: user.username,
      role: user.role,
      action: 'READ_LIST',
      resource: 'patient',
      details: `Pregledana lista pacijenata (${patients.length} zapisa).`,
      ip: req.socket.remoteAddress || '',
    });

    sendJson(res, 200, { patients });
  });

  // ---- READ single ----
  router.get('/api/patients/:id', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator', 'lekar'])) return;

    const patient = db.getPatientByIdDecrypted(req.params.id);
    if (!patient) {
      sendJson(res, 404, { error: 'Pacijent nije pronadjen.' });
      return;
    }

    audit.record({
      username: user.username,
      role: user.role,
      action: 'READ',
      resource: 'patient',
      resourceId: patient.id,
      details: `Pregledan karton pacijenta #${patient.id} (${patient.ime} ${patient.prezime}).`,
      ip: req.socket.remoteAddress || '',
    });

    sendJson(res, 200, { patient });
  });

  // ---- CREATE ----
  router.post('/api/patients', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator', 'lekar'])) return;

    const fields = pickAllowedFields(req.body || {});
    const validationError = validateRequired(fields);
    if (validationError) {
      sendJson(res, 400, { error: validationError });
      return;
    }

    const patient = db.createPatient(fields, user.username);

    audit.record({
      username: user.username,
      role: user.role,
      action: 'CREATE',
      resource: 'patient',
      resourceId: patient.id,
      details: `Kreiran karton pacijenta #${patient.id} (${patient.ime} ${patient.prezime}).`,
      ip: req.socket.remoteAddress || '',
    });

    sendJson(res, 201, { patient });
  });

  // ---- UPDATE ----
  router.put('/api/patients/:id', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator', 'lekar'])) return;

    const fields = pickAllowedFields(req.body || {});
    const updated = db.updatePatient(req.params.id, fields, user.username);
    if (!updated) {
      sendJson(res, 404, { error: 'Pacijent nije pronadjen.' });
      return;
    }

    audit.record({
      username: user.username,
      role: user.role,
      action: 'UPDATE',
      resource: 'patient',
      resourceId: updated.id,
      details: `Izmenjen karton pacijenta #${updated.id}. Izmenjena polja: ${Object.keys(fields).join(', ')}.`,
      ip: req.socket.remoteAddress || '',
    });

    sendJson(res, 200, { patient: updated });
  });

  // ---- DELETE (administrator only) ----
  router.delete('/api/patients/:id', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireRole(user, res, ['administrator'])) return;

    const existed = db.deletePatient(req.params.id);
    if (!existed) {
      sendJson(res, 404, { error: 'Pacijent nije pronadjen.' });
      return;
    }

    audit.record({
      username: user.username,
      role: user.role,
      action: 'DELETE',
      resource: 'patient',
      resourceId: Number(req.params.id),
      details: `Obrisan karton pacijenta #${req.params.id}.`,
      ip: req.socket.remoteAddress || '',
    });

    sendJson(res, 200, { success: true });
  });
}

module.exports = { register };
