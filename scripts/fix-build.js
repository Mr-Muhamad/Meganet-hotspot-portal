const fs = require('fs');
const path = require('path');
const buildPath = path.join(process.env.INIT_CWD || '.', 'build.js');
const tempPath = path.join(process.env.TEMP || '.', 'build.js.new');
let c = fs.readFileSync(buildPath, 'utf8');
c = c.replace('  return js;\n}', '  js += "window.Hotspot = { util: util, ui: ui, i18n: i18n, auth: auth, status: statusModule };\\n";\n  return js;\n}');
fs.writeFileSync(tempPath, c, 'utf8');
fs.copyFileSync(tempPath, buildPath);
console.log('Fixed build.js');
