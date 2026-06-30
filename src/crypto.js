/**
 * crypto.js
 * -----------------------------------------------------------------------
 * Field-level encryption for sensitive data ("enkripcija osetljivih
 * informacija"). Uses ONLY Node's built-in `crypto` module (AES-256-GCM) —
 * no third-party dependency is installed, which deliberately reduces the
 * software supply-chain attack surface (see README, section "Zasto bez
 * eksternih biblioteka?").
 *
 * AES-256-GCM is an authenticated encryption mode: it provides both
 * confidentiality (the data cannot be read without the key) AND integrity
 * (any tampering with the ciphertext is detected via the auth tag).
 *
 * Storage format for an encrypted field (single string, hex-encoded parts
 * separated by ":"):
 *      <iv>:<authTag>:<ciphertext>
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is the NIST-recommended length for GCM
const KEY_LENGTH_BYTES = 32; // 256-bit key

function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY nije podesen u .env fajlu. Pokrenite "node scripts/bootstrap-env.js" ili kopirajte .env.example u .env.'
    );
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`ENCRYPTION_KEY mora biti ${KEY_LENGTH_BYTES * 2} hex karaktera (${KEY_LENGTH_BYTES} bajtova).`);
  }
  return key;
}

/**
 * Encrypts a single field value. Returns null unchanged (so optional
 * fields don't crash), otherwise returns "iv:authTag:ciphertext" (hex).
 */
function encryptField(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypts a value produced by encryptField. Throws if the auth tag does
 * not match (i.e. ciphertext was tampered with) — this is the integrity
 * guarantee GCM provides on top of plain confidentiality.
 */
function decryptField(encoded) {
  if (encoded === null || encoded === undefined) return null;
  const key = getKey();
  const parts = String(encoded).split(':');
  if (parts.length !== 3) throw new Error('Neispravan format enkriptovanog polja.');
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Generates a fresh random 256-bit key as a hex string (used by bootstrap-env.js). */
function generateKeyHex() {
  return crypto.randomBytes(KEY_LENGTH_BYTES).toString('hex');
}

module.exports = { encryptField, decryptField, generateKeyHex };
