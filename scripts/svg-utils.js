/**
 * svg-utils.js — Shared SVG sanitization and SVGO optimization helper.
 *
 * Operator-uploaded or imported SVG logos are injected inline into the hotspot
 * portal HTML ({{ logoInline | safe }}). Sanitization removes active content
 * (<script>, <foreignObject>, on* attributes, javascript: URIs) before
 * running SVGO to slim the payload for MikroTik router flash storage.
 */

'use strict';

const crypto = require('crypto');
const { optimize } = require('svgo');

const DANGEROUS_TAG_RE = /<(script|foreignObject|iframe|object|embed|meta|link|set|animate|animateTransform|animateMotion)\b[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_SELF_TAG_RE = /<(script|foreignObject|iframe|object|embed|meta|link|set|animate|animateTransform|animateMotion)\b[^>]*\/?>/gi;
const EVENT_ATTR_RE = /([\s/"'])on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const URI_ATTR_RE = /\b(href|xlink:href|src|action|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;

function decodeForSchemeCheck(val) {
  const decoded = String(val || '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#(\d+);?/g, (_, dec) => {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    })
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '');
  let out = '';
  for (let i = 0; i < decoded.length; i++) {
    const code = decoded.charCodeAt(i);
    if (code >= 32 && !/\s/.test(decoded[i])) {
      out += decoded[i];
    }
  }
  return out.toLowerCase();
}

function isDangerousUri(val) {
  const normalized = decodeForSchemeCheck(val);
  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html') ||
    normalized.startsWith('data:image/svg+xml')
  );
}

function sanitizeStyleBlock(cssText) {
  return String(cssText || '')
    .replace(/@import[^;]*(?:;|$)/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, 'none')
    .replace(/url\s*\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (full, _q, inner) => {
      const compact = decodeForSchemeCheck(inner);
      if (
        compact.startsWith('http:') ||
        compact.startsWith('https:') ||
        compact.startsWith('//') ||
        compact.startsWith('javascript:') ||
        compact.startsWith('vbscript:') ||
        compact.startsWith('data:text/html') ||
        compact.startsWith('data:image/svg+xml')
      ) {
        return 'none';
      }
      return full;
    })
    .replace(/(javascript|vbscript)\s*:/gi, '');
}

function stripDangerousMarkup(svg) {
  let out = String(svg || '');
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, '');
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  for (let pass = 0; pass < 5; pass++) {
    const prev = out;
    out = out.replace(DANGEROUS_TAG_RE, '');
    out = out.replace(DANGEROUS_SELF_TAG_RE, '');
    out = out.replace(EVENT_ATTR_RE, (_m, lead) => ((lead === '"' || lead === "'") ? lead + ' ' : ' '));
    if (out === prev) break;
  }

  out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, (_m, attrs, cssText) => {
    return `<style${attrs}>${sanitizeStyleBlock(cssText)}</style>`;
  });

  out = out.replace(URI_ATTR_RE, (full, attr, dq, sq, uq) => {
    const val = dq !== undefined ? dq : (sq !== undefined ? sq : (uq || ''));
    if (!isDangerousUri(val)) return full;
    const q = sq !== undefined ? "'" : '"';
    return `${attr}=${q}#${q}`;
  });

  return out.trim();
}

function sanitizeSvg(svgString, options = {}) {
  const cleaned = stripDangerousMarkup(svgString);
  if (!/<svg\b/i.test(cleaned)) {
    if (options.strict) {
      throw new Error('invalid SVG file: missing <svg> root element');
    }
    return cleaned;
  }

  if (options.optimize === false) {
    return cleaned;
  }

  try {
    const idPrefix = options.idPrefix || `s${crypto.createHash('sha1').update(cleaned).digest('hex').slice(0, 6)}`;
    const plugins = [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: false,
            removeHiddenElems: false,
            inlineStyles: false,
            cleanupIds: false,
            collapseGroups: false
          }
        }
      }
    ];
    if (options.prefixIds !== false) {
      plugins.push({
        name: 'prefixIds',
        params: {
          prefix: idPrefix,
          delim: '-',
          prefixClassNames: false
        }
      });
    }
    const result = optimize(cleaned, {
      multipass: true,
      plugins
    });
    if (result && typeof result.data === 'string' && /<svg\b/i.test(result.data)) {
      return stripDangerousMarkup(result.data);
    }
  } catch {
    // Keep sanitized markup if SVGO cannot parse minimal/custom fragments
  }
  return stripDangerousMarkup(cleaned);
}

module.exports = { sanitizeSvg, stripDangerousMarkup };
