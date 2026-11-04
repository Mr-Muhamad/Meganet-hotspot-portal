const fs = require('fs');
const buildPath = 'build.js';
let content = fs.readFileSync(buildPath, 'utf8');
content = content.replace(/'login', 'status', 'logout', 'error'/g, "'index', 'login', 'status', 'logout', 'error'");
fs.writeFileSync(buildPath, content, 'utf8');
const matches = content.match(/'login', 'status', 'logout', 'error'/g);
console.log('Remaining occurrences:', matches ? matches.length : 0);
console.log('Updated build.js pages list');
