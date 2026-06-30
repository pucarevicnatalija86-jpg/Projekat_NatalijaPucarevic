/**
 * router.js
 * -----------------------------------------------------------------------
 * A deliberately small router built on Node's built-in `http` module —
 * the project uses no web framework (no Express) so that the entire
 * dependency tree is zero third-party packages. Supports:
 *   - path params (`/api/patients/:id`)
 *   - JSON body parsing for POST/PUT
 *   - static file serving for the frontend in /public
 */

'use strict';

const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    // Basic hardening headers — not the focus of the assignment, but
    // cheap to add and good practice on every response.
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    const MAX_BYTES = 1024 * 1024; // 1MB cap against trivial body-flood abuse
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new Error('Telo zahteva je previse veliko.'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Neispravan JSON u telu zahteva.'));
      }
    });
    req.on('error', reject);
  });
}

class Router {
  constructor() {
    this.routes = []; // { method, segments, paramNames, handler }
  }

  _add(method, routePath, handler) {
    const segments = routePath.split('/').filter(Boolean);
    const paramNames = [];
    segments.forEach((seg, i) => {
      if (seg.startsWith(':')) paramNames.push({ index: i, name: seg.slice(1) });
    });
    this.routes.push({ method, segments, paramNames, handler });
  }

  get(p, h) { this._add('GET', p, h); }
  post(p, h) { this._add('POST', p, h); }
  put(p, h) { this._add('PUT', p, h); }
  delete(p, h) { this._add('DELETE', p, h); }

  _match(method, urlSegments) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== urlSegments.length) continue;
      const params = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const routeSeg = route.segments[i];
        if (routeSeg.startsWith(':')) {
          params[routeSeg.slice(1)] = decodeURIComponent(urlSegments[i]);
        } else if (routeSeg !== urlSegments[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }

  /** Returns a Node `http` request listener. */
  handler(staticDir) {
    return async (req, res) => {
      const parsed = url.parse(req.url, true);
      const urlSegments = parsed.pathname.split('/').filter(Boolean);

      req.query = parsed.query;

      const isApi = parsed.pathname.startsWith('/api/');

      if (isApi) {
        const match = this._match(req.method, urlSegments);
        if (!match) {
          sendJson(res, 404, { error: `Ruta nije pronadjena: ${req.method} ${parsed.pathname}` });
          return;
        }
        req.params = match.params;
        try {
          if (['POST', 'PUT'].includes(req.method)) {
            req.body = await readJsonBody(req);
          } else {
            req.body = {};
          }
          await match.handler(req, res);
        } catch (err) {
          sendJson(res, 400, { error: err.message || 'Greska na serveru.' });
        }
        return;
      }

      // Static file serving for the frontend.
      serveStatic(req, res, staticDir, parsed.pathname);
    };
  }
}

function serveStatic(req, res, staticDir, pathname) {
  let relPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(staticDir, relPath);

  // Prevent path traversal outside the static directory.
  if (!filePath.startsWith(staticDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - Stranica nije pronadjena');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

module.exports = { Router, sendJson, readJsonBody };
