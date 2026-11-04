const fs = require('fs');
const loginPath = 'src/templates/login.html';
const errorPath = 'src/templates/error.html';

let login = fs.readFileSync(loginPath, 'utf8');
login = login.replace(
  /<div class="alert alert-error" role="alert">/g,
  '<div class="alert alert-error" role="alert" data-display-error="$(error)">'
);
login = login.replace(
  /<span class="alert__text" id="errorMessage">\$\(error-esc\)<\/span>/g,
  '<span class="alert__text" id="errorMessage"></span>'
);
fs.writeFileSync(loginPath, login, 'utf8');
console.log('patched login.html');

let error = fs.readFileSync(errorPath, 'utf8');
error = error.replace(
  /<span class="alert__text" id="error-message">\$\(error-esc\)<\/span>/g,
  '<span class="alert__text" id="error-message">$(error)</span>'
);
error = error.replace(
  /Error Code: <strong>\$\(error-esc\)<\/strong>/g,
  'Error Code: <strong>$(error)</strong>'
);
fs.writeFileSync(errorPath, error, 'utf8');
console.log('patched error.html');
