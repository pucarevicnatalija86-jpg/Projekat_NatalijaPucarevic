/**
 * scripts/bootstrap-env.js
 * -----------------------------------------------------------------------
 * Creates a .env file with freshly generated secrets if one doesn't
 * already exist. Run automatically by server.js on startup, and can also
 * be run manually: `node scripts/bootstrap-env.js`.
 *
 * IMPORTANT: once generated, .env must stay the SAME across restarts —
 * regenerating ENCRYPTION_KEY would make all previously encrypted
 * jmbg/dijagnoza fields permanently undecryptable. That's why this only
 * writes the file if it does not already exist, and .env is in
 * .gitignore (secrets never belong in version control).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = path.join(__dirname, '..', '.env');

function ensureEnv() {
  if (fs.existsSync(ENV_PATH)) {
    return false; // already exists, nothing to do
  }

  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const jwtSecret = crypto.randomBytes(32).toString('hex');

  const contents = `# Generisano automatski - ne deliti i ne komitovati na GitHub!
# (.env je vec naveden u .gitignore)

# 256-bit (64 hex karaktera) kljuc za AES-256-GCM enkripciju osetljivih polja
ENCRYPTION_KEY=${encryptionKey}

# Tajni kljuc za potpisivanje JWT tokena (HMAC-SHA256)
JWT_SECRET=${jwtSecret}

# Port na kome server slusa
PORT=3000

# Na koliko minuta se automatski pravi rezervna kopija baze ("redovno kreiranje backup-a")
BACKUP_INTERVAL_MINUTES=60
`;

  fs.writeFileSync(ENV_PATH, contents, 'utf8');
  return true;
}

function loadEnv() {
  ensureEnv();
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

module.exports = { ensureEnv, loadEnv, ENV_PATH };

if (require.main === module) {
  const created = ensureEnv();
  console.log(created ? `.env kreiran: ${ENV_PATH}` : `.env vec postoji: ${ENV_PATH}`);
}
