const fs = require("fs");
const loginPath = "src/templates/login.html";
const cssPath = "src/css/components.css";

let login = fs.readFileSync(loginPath, "utf8");
const oldBrandBlock = `<div class="card-header__brand">
            <svg class="card-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            <img class="card-header__logo" src="/assets/prand-title.svg" alt="Brand" onerror="this.style.display='none'">
          </div>`;

const newBrandBlock = `<div class="card-header__brand">
            <img class="card-header__logo" src="/assets/prand-title.svg" alt="Brand" onerror="this.style.display='none'">
            <svg class="card-header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
          </div>`;

if (!login.includes(oldBrandBlock)) {
  console.error("ERROR: Could not find brand block in login.html");
  process.exit(1);
}
login = login.replace(oldBrandBlock, newBrandBlock);
fs.writeFileSync(loginPath, login, "utf8");
console.log("patched login.html brand order");

let css = fs.readFileSync(cssPath, "utf8");
const oldIcon = `.card-header__icon {
  width: 48px;
  height: 48px;
  margin: 0 auto var(--space-md);
  color: var(--color-primary);
}`;

const newIcon = `.card-header__icon {
  width: 24px;
  height: 24px;
  margin: 0;
  color: var(--color-primary);
}

.card-header__logo {
  height: 48px;
  width: auto;
  max-width: 220px;
  object-fit: contain;
}`;

if (!css.includes(oldIcon)) {
  console.error("ERROR: Could not find card-header__icon block in components.css");
  process.exit(1);
}
css = css.replace(oldIcon, newIcon);
fs.writeFileSync(cssPath, css, "utf8");
console.log("patched components.css sizes");
