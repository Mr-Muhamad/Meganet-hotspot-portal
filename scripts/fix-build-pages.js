const fs = require('fs');
const buildPath = 'build.js';
let content = fs.readFileSync(buildPath, 'utf8');

// Fix the page arrays - remove duplicates
content = content.replace(/\['index', 'index', 'login', 'status', 'logout', 'error'\]/g, "['index', 'login', 'status', 'logout', 'error']");

fs.writeFileSync(buildPath, content, 'utf8');
console.log('Fixed duplicate index entries');
