/**
 * qr-generator.js — Zero-dependency ISO/IEC 18004 QR Code SVG generator and
 * A4 / 80mm / 58mm thermal printable voucher sheet builder for Meganet Hotspot Studio.
 *
 * Encodes UTF-8 byte-mode strings (Versions 1..10, ECC Level L) with full GF(256)
 * Reed-Solomon error correction, ISO 18004 Version Info (V7+), and 8-mask
 * penalty evaluation so generated QR codes scan reliably on phone cameras,
 * POS thermal receipts, and the built-in jsQR scanner.
 */

'use strict';

// Version 1..10 capabilities for ECC Level L:
// g1: [count, dataCodewordsPerBlock], g2: [count, dataCodewordsPerBlock]
const VERSION_TABLE = [
  null,
  { size: 21, total: 26, ec: 7, g1: [1, 19], g2: [0, 0], align: [] },
  { size: 25, total: 44, ec: 10, g1: [1, 34], g2: [0, 0], align: [6, 18] },
  { size: 29, total: 70, ec: 15, g1: [1, 55], g2: [0, 0], align: [6, 22] },
  { size: 33, total: 100, ec: 20, g1: [1, 80], g2: [0, 0], align: [6, 26] },
  { size: 37, total: 134, ec: 26, g1: [1, 108], g2: [0, 0], align: [6, 30] },
  { size: 41, total: 172, ec: 18, g1: [2, 68], g2: [0, 0], align: [6, 34] },
  { size: 45, total: 196, ec: 20, g1: [2, 78], g2: [0, 0], align: [6, 22, 38] },
  { size: 49, total: 242, ec: 24, g1: [2, 97], g2: [0, 0], align: [6, 24, 42] },
  { size: 53, total: 292, ec: 30, g1: [2, 116], g2: [0, 0], align: [6, 26, 46] },
  { size: 57, total: 346, ec: 18, g1: [2, 68], g2: [2, 69], align: [6, 28, 50] }
];

// GF(256) log/exp tables with primitive polynomial 0x11D
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(dataBytes, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Array(ecLen).fill(0);
  for (const b of dataBytes) {
    const factor = b ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < ecLen; i++) {
      rem[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return rem;
}

function dataCapacityBytes(info) {
  return info.g1[0] * info.g1[1] + info.g2[0] * info.g2[1];
}

function pickVersion(byteLength) {
  for (let v = 1; v <= 10; v++) {
    const info = VERSION_TABLE[v];
    const dataCap = dataCapacityBytes(info);
    // 4-bit mode + (8-bit count for V1..9, 16-bit count for V10+) -> overhead 2 or 3 bytes
    const headerBytes = v >= 10 ? 3 : 2;
    if (byteLength + headerBytes <= dataCap) return v;
  }
  throw new Error('QR text too long (max ~271 bytes)');
}

function buildCodewords(utf8Bytes, version) {
  const info = VERSION_TABLE[version];
  const dataCap = dataCapacityBytes(info);
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Byte mode indicator (0100) + byte count (8 bits for V1..9, 16 bits for V10+)
  pushBits(0b0100, 4);
  pushBits(utf8Bytes.length, version >= 10 ? 16 : 8);
  for (const b of utf8Bytes) pushBits(b, 8);

  const maxBits = dataCap * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataWords.push(byte);
  }

  let padToggle = true;
  while (dataWords.length < dataCap) {
    dataWords.push(padToggle ? 0xec : 0x11);
    padToggle = !padToggle;
  }

  const totalBlocks = info.g1[0] + info.g2[0];
  if (totalBlocks === 1) {
    return dataWords.concat(rsEncode(dataWords, info.ec));
  }

  const dBlocks = [];
  const eBlocks = [];
  let offset = 0;
  for (let i = 0; i < info.g1[0]; i++) {
    const slice = dataWords.slice(offset, offset + info.g1[1]);
    offset += info.g1[1];
    dBlocks.push(slice);
    eBlocks.push(rsEncode(slice, info.ec));
  }
  for (let i = 0; i < info.g2[0]; i++) {
    const slice = dataWords.slice(offset, offset + info.g2[1]);
    offset += info.g2[1];
    dBlocks.push(slice);
    eBlocks.push(rsEncode(slice, info.ec));
  }

  const maxDataLen = Math.max(info.g1[1], info.g2[1]);
  const out = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dBlocks[b].length) out.push(dBlocks[b][i]);
    }
  }
  for (let i = 0; i < info.ec; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      out.push(eBlocks[b][i]);
    }
  }
  return out;
}

function computeFormatBits(maskId) {
  // ECC Level L = 01 (2 bits) + 3-bit maskId
  const data = (0b01 << 3) | (maskId & 7);
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= poly << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version) {
  let rem = version << 12;
  const poly = 0x1f25;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) rem ^= poly << (i - 12);
  }
  return (version << 12) | rem;
}

function maskPredicate(maskId, r, c) {
  switch (maskId) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
    case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
    case 7: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
    default: return false;
  }
}

function evaluatePenalty(matrix, size) {
  let score = 0;

  // Rule 1: 5+ consecutive modules of same color in rows and columns
  const evalLine = (getMod) => {
    let runColor = getMod(0);
    let runLen = 1;
    for (let i = 1; i < size; i++) {
      const m = getMod(i);
      if (m === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = m;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  };
  for (let r = 0; r < size; r++) evalLine((c) => matrix[r][c]);
  for (let c = 0; c < size; c++) evalLine((r) => matrix[r][c]);

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const m = matrix[r][c];
      if (m === matrix[r][c + 1] && m === matrix[r + 1][c] && m === matrix[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 3: Finder-like 1:1:3:1:1 patterns with 4 light modules on either side
  const isPatA = (getMod, start) =>
    getMod(start) && !getMod(start + 1) && getMod(start + 2) && getMod(start + 3) &&
    getMod(start + 4) && !getMod(start + 5) && getMod(start + 6) &&
    !getMod(start + 7) && !getMod(start + 8) && !getMod(start + 9) && !getMod(start + 10);
  const isPatB = (getMod, start) =>
    !getMod(start) && !getMod(start + 1) && !getMod(start + 2) && !getMod(start + 3) &&
    getMod(start + 4) && !getMod(start + 5) && getMod(start + 6) && getMod(start + 7) &&
    getMod(start + 8) && !getMod(start + 9) && getMod(start + 10);

  for (let i = 0; i < size; i++) {
    const rowFn = (k) => matrix[i][k];
    const colFn = (k) => matrix[k][i];
    for (let k = 0; k <= size - 11; k++) {
      if (isPatA(rowFn, k) || isPatB(rowFn, k)) score += 40;
      if (isPatA(colFn, k) || isPatB(colFn, k)) score += 40;
    }
  }

  // Rule 4: Dark/light ratio deviation from 50%
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) dark++;
    }
  }
  const pct = (dark * 100) / (size * size);
  const k = Math.min(Math.floor(Math.abs(pct - 50) / 5), 10);
  score += k * 10;

  return score;
}

function encodeQrMatrix(text) {
  const str = String(text || '');
  if (!str) throw new Error('QR text cannot be empty');
  const utf8 = Array.from(Buffer.from(str, 'utf8'));
  const version = pickVersion(utf8.length);
  const info = VERSION_TABLE[version];
  const size = info.size;

  const baseMatrix = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (mat, r, c, dark, markReserved = false) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    mat[r][c] = !!dark;
    if (markReserved) reserved[r][c] = true;
  };

  const placeFinder = (row, col) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setModule(baseMatrix, r, c, inOuter || inInner, true);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  const align = info.align;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      const ar = align[i];
      const ac = align[j];
      if (reserved[ar][ac]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(baseMatrix, ar + dr, ac + dc, dark, true);
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(baseMatrix, 6, i, i % 2 === 0, true);
    if (!reserved[i][6]) setModule(baseMatrix, i, 6, i % 2 === 0, true);
  }

  setModule(baseMatrix, size - 8, 8, true, true);
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = true;
    if (!reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = true;
  }

  // Version Information (Versions 7+)
  if (version >= 7) {
    const vBits = computeVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setModule(baseMatrix, a, b, bit, true);
      setModule(baseMatrix, b, a, bit, true);
    }
  }

  const codewords = buildCodewords(utf8, version);
  const allBits = [];
  for (const cw of codewords) {
    for (let b = 7; b >= 0; b--) allBits.push((cw >> b) & 1);
  }

  // Evaluate all 8 ISO/IEC 18004 masks and pick the lowest penalty score
  let bestMask = 0;
  let bestScore = Infinity;
  let bestMatrix = null;

  for (let maskId = 0; maskId < 8; maskId++) {
    const mat = baseMatrix.map((row) => row.slice());
    let bitIdx = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        const r = upward ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          if (reserved[r][c]) continue;
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] === 1 : false;
          mat[r][c] = bit !== maskPredicate(maskId, r, c);
        }
      }
      upward = !upward;
    }

    const formatBits = computeFormatBits(maskId);
    for (let i = 0; i <= 5; i++) mat[8][i] = ((formatBits >> i) & 1) === 1;
    mat[8][7] = ((formatBits >> 6) & 1) === 1;
    mat[8][8] = ((formatBits >> 7) & 1) === 1;
    mat[7][8] = ((formatBits >> 8) & 1) === 1;
    for (let i = 9; i < 15; i++) mat[14 - i][8] = ((formatBits >> i) & 1) === 1;

    for (let i = 0; i < 8; i++) mat[8][size - 1 - i] = ((formatBits >> i) & 1) === 1;
    for (let i = 8; i < 15; i++) mat[size - 15 + i][8] = ((formatBits >> i) & 1) === 1;

    const penalty = evaluatePenalty(mat, size);
    if (penalty < bestScore) {
      bestScore = penalty;
      bestMask = maskId;
      bestMatrix = mat;
    }
  }

  return { version, size, mask: bestMask, matrix: bestMatrix };
}

function escapeXml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/**
 * Render a QR code as a crisp, standalone SVG string.
 */
function generateQrSvg(text, options = {}) {
  const { size, matrix } = encodeQrMatrix(text);
  const margin = options.margin != null ? Number(options.margin) : 2;
  const fg = options.color || '#020617';
  const bg = options.background || '#ffffff';
  const total = size + margin * 2;

  let pathData = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        pathData += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(text)}">` +
    `<rect width="${total}" height="${total}" fill="${escapeXml(bg)}"/>` +
    `<path d="${pathData}" fill="${escapeXml(fg)}"/>` +
    `</svg>`
  );
}

/**
 * Parse CSV/line-based voucher input into normalized voucher objects.
 */
function parseVoucherCsv(csvText, defaults = {}) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const vouchers = [];
  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    const code = parts[0];
    if (!code || code.toLowerCase() === 'code' || code.toLowerCase() === 'voucher') continue;
    const plan = parts[1] || defaults.plan || 'باقة إنترنت';
    const quota = parts[2] || defaults.quota || '10 GB';
    const price = parts[3] || defaults.price || '';
    const baseUrl = defaults.dnsName
      ? (defaults.dnsName.startsWith('http') ? defaults.dnsName : `http://${defaults.dnsName}/login`)
      : '';
    let qrPayload = code;
    if (baseUrl && defaults.qrMode !== 'code') {
      const passParam = defaults.voucherPasswordMode === 'empty' ? '' : `&password=${encodeURIComponent(code)}`;
      qrPayload = `${baseUrl}?username=${encodeURIComponent(code)}${passParam}`;
    }
    vouchers.push({ code, plan, quota, price, qrPayload });
  }
  return vouchers;
}

/**
 * Generate a complete printable HTML sheet for branded QR voucher cards.
 * Supports `options.format`: 'a4' (default 3-col grid), '80mm', or '58mm' POS thermal rolls.
 */
function generatePrintSheetHtml(vouchers, config = {}, options = {}) {
  const general = config.general || {};
  const theme = config.theme || {};
  const networkName = general.networkName || 'Meganet WiFi';
  const primaryColor = /^#[0-9a-fA-F]{6}$/.test(theme.primaryColor || '') ? theme.primaryColor : '#22c55e';
  const bgColor = /^#[0-9a-fA-F]{6}$/.test(theme.backgroundColor || '') ? theme.backgroundColor : '#0f172a';
  const format = ['a4', '80mm', '58mm'].includes(options.format) ? options.format : 'a4';
  const isThermal = format === '80mm' || format === '58mm';

  const cardsHtml = (vouchers || []).map((v) => {
    const qrSvg = generateQrSvg(v.qrPayload || v.code, { color: '#0f172a', background: '#ffffff', margin: 1 });
    return (
      `<div class="v-card">` +
      `<div class="v-head" style="background:${escapeXml(isThermal ? '#0f172a' : bgColor)};border-bottom:3px solid ${escapeXml(primaryColor)}">` +
      `<span class="v-net">${escapeXml(networkName)}</span>` +
      `<span class="v-plan" style="background:${escapeXml(primaryColor)};color:#052e16">${escapeXml(v.plan || '')}</span>` +
      `</div>` +
      `<div class="v-body">` +
      `<div class="v-qr">${qrSvg}</div>` +
      `<div class="v-info">` +
      `<div class="v-label">كود الشحن / Voucher</div>` +
      `<div class="v-code">${escapeXml(v.code)}</div>` +
      `<div class="v-meta">` +
      (v.quota ? `<span>📦 ${escapeXml(v.quota)}</span>` : '') +
      (v.price ? `<span>💰 ${escapeXml(v.price)}</span>` : '') +
      `</div>` +
      `</div>` +
      `</div>` +
      `<div class="v-foot">${escapeXml(options.footerNote || 'امسح رمز الـ QR بالكاميرا للدخول الفوري')}</div>` +
      `</div>`
    );
  }).join('\n');

  let pageCss;
  let printTitle;
  if (format === '80mm') {
    printTitle = '🖨 طباعة رول حراري (80mm)';
    pageCss = `
  @page { size: 80mm auto; margin: 3mm; }
  body { max-width: 76mm; margin: 0 auto; }
  .sheet { display: flex; flex-direction: column; gap: 6mm; }
  .v-card { width: 100%; border: 1.5px solid #0f172a; border-radius: 6px; page-break-after: always; }
  .v-qr { width: 64px; height: 64px; }
  .v-code { font-size: 17px; }`;
  } else if (format === '58mm') {
    printTitle = '🖨 طباعة رول حراري (58mm)';
    pageCss = `
  @page { size: 58mm auto; margin: 2mm; }
  body { max-width: 54mm; margin: 0 auto; }
  .sheet { display: flex; flex-direction: column; gap: 4mm; }
  .v-card { width: 100%; border: 1px solid #0f172a; border-radius: 4px; page-break-after: always; }
  .v-body { flex-direction: column; text-align: center; gap: 6px; padding: 6px; }
  .v-qr { width: 72px; height: 72px; }
  .v-code { font-size: 15px; }
  .v-meta { justify-content: center; flex-wrap: wrap; }`;
  } else {
    printTitle = '🖨 طباعة الكروت (A4)';
    pageCss = `
  @page { size: A4; margin: 10mm; }
  .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .v-qr { width: 68px; height: 68px; }
  .v-code { font-size: 16px; }`;
  }

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>طباعة كروت (${format.toUpperCase()}) — ${escapeXml(networkName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; background: #f8fafc; color: #0f172a; padding: 12px; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 16px; background: #0f172a; color: #fff; border-radius: 10px; }
  .toolbar button { background: ${escapeXml(primaryColor)}; color: #052e16; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  .v-card { background: #fff; border: 1.5px solid #cbd5e1; border-radius: 10px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .v-head { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; color: #fff; font-size: 12px; font-weight: 700; }
  .v-plan { padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .v-body { display: flex; align-items: center; gap: 10px; padding: 10px; }
  .v-qr { flex-shrink: 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .v-qr svg { width: 100%; height: 100%; display: block; }
  .v-info { flex: 1; min-width: 0; }
  .v-label { font-size: 10px; color: #64748b; margin-bottom: 2px; }
  .v-code { font-family: monospace; font-weight: 800; letter-spacing: 1px; color: #0f172a; background: #f1f5f9; padding: 3px 6px; border-radius: 5px; display: inline-block; margin-bottom: 4px; word-break: break-all; }
  .v-meta { display: flex; gap: 8px; font-size: 11px; color: #334155; font-weight: 600; }
  .v-foot { font-size: 9px; text-align: center; color: #64748b; background: #f8fafc; padding: 4px; border-top: 1px dashed #e2e8f0; }
  ${pageCss}
  @media print {
    body { background: #fff; padding: 0; }
    .toolbar { display: none !important; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <div><strong>${escapeXml(networkName)}</strong> — جاهز للطباعة (${(vouchers || []).length} كرت · ${format.toUpperCase()})</div>
    <button onclick="window.print()">${printTitle}</button>
  </div>
  <div class="sheet">
    ${cardsHtml}
  </div>
</body>
</html>`;
}

module.exports = {
  encodeQrMatrix,
  generateQrSvg,
  parseVoucherCsv,
  generatePrintSheetHtml
};
