import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT muss eine ganze Zahl zwischen 0 und 65535 sein.');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function sendText(request, response, status, message, extraHeaders = {}) {
  const body = `${message}\n`;
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function isPublicPath(path) {
  const segments = relative(root, path).split(sep);
  return !isAbsolute(relative(root, path)) &&
    !segments.some(segment => segment.startsWith('.'));
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(request, response, 405, 'Methode nicht erlaubt.', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    if (!request.url?.startsWith('/')) throw new Error('Invalid path');
    pathname = decodeURIComponent(request.url.split(/[?#]/, 1)[0]);
  } catch {
    sendText(request, response, 400, 'Ungültige Anfrage.');
    return;
  }

  if (pathname.includes('\0') || pathname.includes('\\') ||
      pathname.split('/').some(segment => segment.startsWith('.'))) {
    sendText(request, response, 404, 'Datei nicht gefunden.');
    return;
  }

  try {
    let path = await realpath(resolve(root, `.${pathname}`));
    if (!isPublicPath(path)) {
      sendText(request, response, 404, 'Datei nicht gefunden.');
      return;
    }

    let info = await stat(path);
    if (info.isDirectory()) {
      path = await realpath(resolve(path, 'index.html'));
      if (!isPublicPath(path)) {
        sendText(request, response, 404, 'Datei nicht gefunden.');
        return;
      }
      info = await stat(path);
    }
    if (!info.isFile()) {
      sendText(request, response, 404, 'Datei nicht gefunden.');
      return;
    }

    const body = request.method === 'HEAD' ? null : await readFile(path);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(path).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body?.length ?? info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(body);
  } catch (error) {
    const missing = ['ENOENT', 'ENOTDIR', 'EACCES', 'ELOOP'].includes(error.code);
    sendText(request, response, missing ? 404 : 500,
      missing ? 'Datei nicht gefunden.' : 'Datei konnte nicht geladen werden.');
  }
});

server.on('error', error => {
  console.error(`Server konnte nicht gestartet werden: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const address = server.address();
  const displayHost = host.includes(':') ? `[${host}]` : host;
  console.log(`Tsunami-Animation: http://${displayHost}:${address.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
