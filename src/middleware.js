/**
 * middleware.js
 * -----------------------------------------------------------------------
 * "Implementacija autentifikacije (sa tokenom) i kontrole pristupa (RBAC)."
 *
 * These are small guard functions (not Express middleware, since the
 * project has no framework — see server.js) called explicitly at the top
 * of each route handler:
 *
 *   const user = requireAuth(req, res);       // 401 if missing/invalid token
 *   if (!user) return;                         // response already sent
 *   if (!requireRole(user, res, ['administrator'])) return; // 403 if wrong role
 */

'use strict';

const { verifyToken } = require('./auth');
const { sendJson } = require('./router');

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Verifies the JWT on the request. On success returns the decoded user
 * payload { sub, username, role }. On failure, sends a 401 response
 * itself and returns null — callers must immediately `return` when they
 * get null back.
 */
function requireAuth(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Nedostaje token za autentifikaciju (Authorization: Bearer <token>).' });
    return null;
  }
  try {
    return verifyToken(token);
  } catch (err) {
    sendJson(res, 401, { error: `Nevazeci ili istekao token: ${err.message}` });
    return null;
  }
}

/**
 * Role-based access control check. `allowedRoles` is an array, e.g.
 * ['administrator']. Sends 403 and returns false if the user's role is
 * not in the list.
 */
function requireRole(user, res, allowedRoles) {
  if (!allowedRoles.includes(user.role)) {
    sendJson(res, 403, {
      error: `Pristup odbijen. Ova akcija zahteva ulogu: ${allowedRoles.join(' ili ')}. Vasa uloga: ${user.role}.`,
    });
    return false;
  }
  return true;
}

module.exports = { requireAuth, requireRole, getBearerToken };
