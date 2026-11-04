const fs = require("fs");
const loginPath = "src/templates/login.html";
const content = fs.readFileSync(loginPath, "utf8");

const oldHeader = '        <div class="card-header">\n          <svg class="card-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>\n            <polyline points="10 17 15 12 10 7"/>\n            <line x1="15" y1="12" x2="3" y2="12"/>\n          </svg>\n          <h1 class="card-header__title" data-i18n="login_title">Sign In</h1>\n          <p class="card-header__subtitle" data-i18n="login_subtitle">Enter your credentials to connect</p>\n        </div>';

const newHeader = '        <div class="card-header">\n          <div class="card-header__brand">\n            <svg class="card-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>\n              <polyline points="10 17 15 12 10 7"/>\n              <line x1="15" y1="12" x2="3" y2="12"/>\n            </svg>\n            <img class="card-header__logo" src="/assets/prand-title.svg" alt="Brand" onerror="this.style.display=\'none\'">\n          </div>\n          <h1 class="card-header__title" data-i18n="login_title">Sign In</h1>\n          <p class="card-header__subtitle" data-i18n="login_subtitle">Enter your credentials to connect</p>\n        </div>';

if (!content.includes(oldHeader)) {
  console.error("ERROR: Could not find card header block in login.html");
  process.exit(1);
}

fs.writeFileSync(loginPath, content.replace(oldHeader, newHeader), "utf8");
console.log("patched login.html with brand logo");
