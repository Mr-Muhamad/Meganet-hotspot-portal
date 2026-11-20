/**
 * logo-maker.js — Built-in vector SVG logo, typographic brand title SVG, and
 * binary PNG icon generator for Meganet Hotspot Studio.
 *
 * Produces:
 *   - logo.svg        (vector brand emblem in primaryColor)
 *   - prand-title.svg (vector typographic network title in primaryColor)
 *   - icon.png        (valid 64x64 RGBA PNG generated via Node's built-in zlib)
 */

'use strict';

const zlib = require('zlib');

const ICON_PATHS = {
  wifi: '<path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 14 0M2 9.5a15 15 0 0 1 20 0" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="20" r="1.6" fill="currentColor"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 9.3-7 10-3.5-.7-7-5-7-10V6l7-3z" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="none"/>',
  globe: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" stroke-width="2" fill="none"/>',
  coffee: '<path d="M17 8h1a3 3 0 0 1 0 6h-1M5 8h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zM7 4v2M11 4v2M15 4v2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  crown: '<path d="M3 18h18M4 15l2-9 6 5 6-5 2 9H4z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="none"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="none"/>'
};

function escapeXml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function normalizeHex(hex, fallback) {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex.trim())
    ? hex.trim()
    : fallback;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex, '#22c55e').slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

/**
 * Generate `logo.svg` for the portal header logo slot.
 */
function generateLogoSvg(options = {}) {
  const primary = normalizeHex(options.primaryColor, '#22c55e');
  const bg = normalizeHex(options.backgroundColor, '#020617');
  const iconKey = Object.prototype.hasOwnProperty.call(ICON_PATHS, options.icon) ? options.icon : 'wifi';
  const iconMarkup = ICON_PATHS[iconKey];

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Brand Logo">` +
    `<defs>` +
    `<linearGradient id="mgLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">` +
    `<stop offset="0%" stop-color="${primary}" stop-opacity="0.28"/>` +
    `<stop offset="100%" stop-color="${bg}" stop-opacity="0.95"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect x="4" y="4" width="56" height="56" rx="16" fill="url(#mgLogoGrad)" stroke="${primary}" stroke-width="2.5"/>` +
    `<g transform="translate(14, 14) scale(1.5)" style="color:${primary}">` +
    iconMarkup +
    `</g>` +
    `</svg>`
  );
}

/**
 * Generate `prand-title.svg` typographic SVG for the network brand title.
 */
function generateBrandTitleSvg(options = {}) {
  const networkName = String(options.networkName || 'Meganet').trim().slice(0, 40) || 'Meganet';
  const tagline = String(options.tagline || '').trim().slice(0, 50);
  const primary = normalizeHex(options.primaryColor, '#22c55e');
  const maxChars = Math.max(networkName.length, Math.round(tagline.length * 0.55));
  const width = Math.max(240, Math.min(360, 240 + Math.max(0, maxChars - 12) * 10));
  const cx = Math.round(width / 2);
  const fontSize = networkName.length > 14
    ? Math.max(15, Math.round((24 * 14) / networkName.length))
    : 24;

  const subtitleEl = tagline
    ? `<text x="${cx}" y="48" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif" font-size="11" font-weight="600" fill="${primary}" opacity="0.9">${escapeXml(tagline)}</text>`
    : `<rect x="${cx - 35}" y="43" width="70" height="3.5" rx="2" fill="${primary}" opacity="0.85"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 56" width="${width}" height="56" role="img" aria-label="${escapeXml(networkName)}">` +
    `<title>${escapeXml(networkName)}</title>` +
    `<text x="${cx}" y="33" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif" font-size="${fontSize}" font-weight="800" fill="currentColor">${escapeXml(networkName)}</text>` +
    subtitleEl +
    `</svg>`
  );
}

// CRC32 table for valid PNG chunk generation
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Generate a valid binary RGBA PNG (`icon.png`) drawing a rounded
 * badge in `backgroundColor` with a concentric WiFi/brand emblem in `primaryColor`.
 * Defaults to 512x512 for PWA manifest maskable/any icon compliance.
 */
function generateIconPngBuffer(options = {}) {
  const size = Number(options.size) || 512;
  const fg = hexToRgb(options.primaryColor || '#22c55e');
  const bg = hexToRgb(options.backgroundColor || '#020617');
  const strokeScale = Math.max(1, size / 64);

  // Each scanline has 1 filter byte (0) + size * 4 RGBA bytes
  const raw = Buffer.alloc(size * (1 + size * 4));
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const maxR = size / 2 - Math.max(2, strokeScale * 2);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter type 0 (None)
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxR) {
        // Transparent outside circle badge
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
      } else {
        // Border ring or inner WiFi arcs
        const isBorder = dist >= maxR - 2.5 * strokeScale;
        const isCenterDot = Math.sqrt(dx * dx + (dy - size * 0.16) * (dy - size * 0.16)) <= size * 0.06;
        const arcDist = Math.sqrt(dx * dx + (dy - size * 0.16) * (dy - size * 0.16));
        const inUpperCone = dy < size * 0.12 && Math.abs(dx) <= Math.abs(dy - size * 0.18) * 1.15;
        const isArc1 = inUpperCone && Math.abs(arcDist - size * 0.18) <= 2.0 * strokeScale;
        const isArc2 = inUpperCone && Math.abs(arcDist - size * 0.30) <= 2.0 * strokeScale;

        if (isBorder || isCenterDot || isArc1 || isArc2) {
          raw[px] = fg.r;
          raw[px + 1] = fg.g;
          raw[px + 2] = fg.b;
          raw[px + 3] = 255;
        } else {
          raw[px] = bg.r;
          raw[px + 1] = bg.g;
          raw[px + 2] = bg.b;
          raw[px + 3] = 255;
        }
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 6; // color type 6 (RGBA)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function generateBrandAssets(options = {}) {
  const logoSvg = generateLogoSvg(options);
  const titleSvg = generateBrandTitleSvg(options);
  const iconPng = generateIconPngBuffer(options);
  return {
    logoSvg,
    titleSvg,
    iconPng,
    files: {
      'logo.svg': Buffer.from(logoSvg, 'utf8'),
      'prand-title.svg': Buffer.from(titleSvg, 'utf8'),
      'icon.png': iconPng
    }
  };
}

module.exports = {
  ICON_PATHS,
  generateLogoSvg,
  generateBrandTitleSvg,
  generateIconPngBuffer,
  generateBrandAssets
};
