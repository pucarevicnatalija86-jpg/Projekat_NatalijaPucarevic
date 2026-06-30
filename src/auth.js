/**
 * auth.js
 * -----------------------------------------------------------------------
 * Implements TWO security mechanisms required by the assignment, using
 * only Node's built-in `crypto` module:
 *
 *   1. Token-based authentication ("autentifikacija sa tokenom") — a
 *      hand-rolled but spec-compliant JSON Web Token (RFC 7519):
 *      base64url(header) + "." + base64url(payload) + "." + base64url(HMAC-SHA256 signature)
 *
 *   2. Password storage using scrypt (RFC 7914), a memory-hard key
 *      derivation function built into Node since v10 — NOT reversible
 *      encryption, so even an administrator with full DB access cannot
 *      recover a user's plaintext password.
 */

'use strict';

const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = 60 * 60; // 1h token lifetime

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET nije podesen u .env fajlu.');
  }
  return secret;
}

function sign(data) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Creates a signed JWT carrying { sub, username, role } plus iat/exp. */
function createToken(payload, expiresInSeconds = DEFAULT_TTL_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/** Verifies signature + expiry. Throws on any failure. Returns decoded payload. */
function verifyToken(token) {
  if (typeof token !== 'string' || token.split('.').length !== 3) {
    throw new Error('Malformirani token.');
  }
  const [encodedHeader, encodedPayload, signature] = token.split('.');

  const expected = sign(`${encodedHeader}.${encodedPayload}`);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  // timingSafeEqual requires equal-length buffers; mismatch length => invalid
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Nevazeci potpis tokena.');
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) {
    throw new Error('Token je istekao.');
  }
  return payload;
}

/** Hashes a password with scrypt + random salt. Format: "salt:hash" (hex). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Constant-time password verification against a stored "salt:hash" string. */
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const attempt = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(hash, 'hex');
  if (attempt.length !== original.length) return false;
  return crypto.timingSafeEqual(attempt, original);
}

module.exports = { createToken, verifyToken, hashPassword, verifyPassword };
