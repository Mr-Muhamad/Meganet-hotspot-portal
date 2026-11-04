const fs = require('fs');
const loginPath = 'src/templates/login.html';
let login = fs.readFileSync(loginPath, 'utf8');

const oldScript = `{% block scripts %}
  <script>
    // Initialize modules
    (function() {
      try {
        i18n.init();
        ui.initTheme();
        ui.initLang();
        auth.init();
      } catch (err) {
        console.error('Login page init error:', err);
      }
    })();

    // Populate login error from RouterOS injected data attribute
    (function() {
      try {
        var alertEl = document.querySelector('.alert-error[data-display-error]');
        var errorText = alertEl ? alertEl.getAttribute('data-display-error') : '';
        var messageEl = document.getElementById('errorMessage');
        if (messageEl && errorText) {
          messageEl.textContent = errorText;
        }
      } catch (err) {
        console.error('Error display init error:', err);
      }
    })();
  </script>
{% endblock %}`;

const newScript = `{% block scripts %}
  <script>
    // Initialize modules
    (function() {
      try {
        i18n.init();
        ui.initTheme();
        ui.initLang();
        auth.init();
      } catch (err) {
        console.error('Login page init error:', err);
      }
    })();
  </script>
{% endblock %}`;

login = login.replace(oldScript, newScript);
fs.writeFileSync(loginPath, login, 'utf8');
console.log('removed extra error script from login.html');
