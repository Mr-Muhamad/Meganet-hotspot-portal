const fs = require("fs");
const loginPath = "src/templates/login.html";
let content = fs.readFileSync(loginPath, "utf8");

const oldBlock = `              <input class="form-input" type="password" id="password" name="password"
                       autocomplete="current-password"
                       autocapitalize="none"
                       autocorrect="off"
                       spellcheck="false"
                       required
                       aria-required="true"
                       data-i18n-placeholder="password_placeholder"
                       placeholder="Enter password">
              </div>
            </div>

            <!-- Voucher mode -->`;

const newBlock = `              <input class="form-input" type="password" id="password" name="password"
                       autocomplete="current-password"
                       autocapitalize="none"
                       autocorrect="off"
                       spellcheck="false"
                       required
                       aria-required="true"
                       data-i18n-placeholder="password_placeholder"
                       placeholder="Enter password">
                <button type="button" class="input-toggle" onclick="auth.togglePassword()" aria-label="Show password" title="Show password">
                  <svg class="input-toggle__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            <div class="checkbox-group" data-mode-panel="normal" hidden>
              <input type="checkbox" id="remember-me" checked>
              <label for="remember-me" data-i18n="remember_me">Remember me</label>
            </div>

            <!-- Voucher mode -->`;

const normalizedContent = content.replace(/\r\n/g, "\n");
const normalizedOld = oldBlock.replace(/\r\n/g, "\n");

if (!normalizedContent.includes(normalizedOld)) {
  console.error("ERROR: Could not find expected password block in login.html");
  process.exit(1);
}

content = normalizedContent.replace(normalizedOld, newBlock);
fs.writeFileSync(loginPath, content, "utf8");
console.log("patched login.html");
