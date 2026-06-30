/**
 * routes/authRoutes.js
 * -----------------------------------------------------------------------
 * POST /api/auth/login  — verifies credentials, issues a JWT
 * GET  /api/auth/me     — returns the identity encoded in the caller's token
 */

'use strict';

const { sendJson } = require('../router');
const { findUserByUsername } = require('../db');
const { verifyPassword, createToken } = require('../auth');
const { requireAuth } = require('../middleware');
const audit = require('../audit');

function register(router) {
  router.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    const ip = req.socket.remoteAddress || '';

    if (!username || !password) {
      sendJson(res, 400, { error: 'Korisnicko ime i lozinka su obavezni.' });
      return;
    }

    const user = findUserByUsername(username);
    const valid = user && verifyPassword(password, user.passwordHash);

    if (!valid) {
      audit.record({
        username: username || '(nepoznato)',
        role: user ? user.role : '(nepoznato)',
        action: 'LOGIN_FAILED',
        resource: 'auth',
        details: 'Neuspesna prijava - pogresno korisnicko ime ili lozinka.',
        ip,
      });
      sendJson(res, 401, { error: 'Pogresno korisnicko ime ili lozinka.' });
      return;
    }

    const token = createToken({ sub: user.id, username: user.username, role: user.role });

    audit.record({
      username: user.username,
      role: user.role,
      action: 'LOGIN',
      resource: 'auth',
      details: 'Uspesna prijava.',
      ip,
    });

    sendJson(res, 200, {
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });

  router.get('/api/auth/me', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    sendJson(res, 200, { user: { username: user.username, role: user.role } });
  });
}

module.exports = { register };
