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

function stripDangerousMarkup(svg) {
  let out = String(svg || '');
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, '');
  out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<(script|foreignObject|iframe|object|embed|meta|link)\b[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<(script|foreignObject|iframe|object|embed|meta|link)\b[^>]*\/?>/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  out = out.replace(/(href|xlink:href|src)\s*=\s*"\s*(?:javascript|vbscript|data:text\/html):[^"]*"/gi, '$1="#"');
  out = out.replace(/(href|xlink:href|src)\s*=\s*'\s*(?:javascript|vbscript|data:text\/html):[^']*'/gi, "$1='#'");
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
            removeViewBox: false
          }
        }
      }
    ];
    if (options.prefixIds !== false) {
      plugins.push({
        name: 'prefixIds',
        params: {
          prefix: idPrefix,
          delim: '-'
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
  return cleaned;
}

module.exports = { sanitizeSvg, stripDangerousMarkup };
