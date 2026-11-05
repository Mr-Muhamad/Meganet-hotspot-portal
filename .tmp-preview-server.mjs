import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = join(process.cwd(), 'dist');
const PORT = 8765;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    // Unsubstituted MikroTik vars (e.g. /$(link-redirect)) -> keep showing alogin
    if (urlPath.includes('$(')) urlPath = '/alogin.html';
    let filePath = join(ROOT, urlPath);
    if (urlPath.endsWith('/')) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found: ' + req.url);
  }
}).listen(PORT, '127.0.0.1', () => console.log(`serving dist/ at http://127.0.0.1:${PORT}`));
