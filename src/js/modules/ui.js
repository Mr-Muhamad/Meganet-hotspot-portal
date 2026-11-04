/**
 * UI Module - Theme and language management
 * @module Hotspot.ui
 */
var ui = {
  initTheme: function() {
    try {
      var savedTheme = util.getCookie('hotspot_theme');
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        ui.updateThemeIcon(savedTheme);
      } else {
        var theme = 'dark'; // Force dark mode as the default
        document.documentElement.setAttribute('data-theme', theme);
        ui.updateThemeIcon(theme);
      }
    } catch (err) {
      console.error('Init theme error:', err);
    }
  },

  toggleTheme: function() {
    try {
      var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      util.setCookie('hotspot_theme', newTheme, 365);
      ui.updateThemeIcon(newTheme);
      util.showToast(newTheme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled', 'info', 2000);
    } catch (err) {
      console.error('Toggle theme error:', err);
    }
  },

  updateThemeIcon: function(theme) {
    try {
      var themeToggle = document.querySelector('.theme-toggle');
      if (themeToggle) {
        if (theme === 'dark') {
          themeToggle.innerHTML = '<svg class="theme-toggle__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
          themeToggle.setAttribute('aria-label', 'Switch to light theme');
        } else {
          themeToggle.innerHTML = '<svg class="theme-toggle__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
          themeToggle.setAttribute('aria-label', 'Switch to dark theme');
        }
      }
    } catch (err) {
      console.error('Update theme icon error:', err);
    }
  },

  initLang: function() {
    try {
      var savedLang = util.getCookie('hotspot_lang');
      if (!savedLang) {
        savedLang = 'ar';
        util.setCookie('hotspot_lang', 'ar', 365);
      }

      var isArabicDir = window.location.pathname.indexOf('/ar/') !== -1;
      var redirectPath = null;

      if (savedLang === 'ar' && !isArabicDir) {
        redirectPath = ui.getRedirectPath('ar');
      } else if (savedLang === 'en' && isArabicDir) {
        redirectPath = ui.getRedirectPath('en');
      }

      if (redirectPath) {
        window.location.replace(redirectPath + window.location.search);
        return;
      }

      i18n.setLang(savedLang);
      ui.translateRouterError();
    } catch (err) {
      console.error('Init lang error:', err);
    }
  },

  toggleLang: function() {
    try {
      var currentLang = document.documentElement.getAttribute('lang') || 'en';
      var newLang = currentLang === 'en' ? 'ar' : 'en';
      util.setCookie('hotspot_lang', newLang, 365);

      var redirectPath = ui.getRedirectPath(newLang);
      if (redirectPath) {
        window.location.replace(redirectPath + window.location.search);
      } else {
        i18n.setLang(newLang);
        util.showToast(newLang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English', 'info', 2000);
        ui.translateRouterError();
      }
    } catch (err) {
      console.error('Toggle lang error:', err);
    }
  },

  getRedirectPath: function(targetLang) {
    try {
      var path = window.location.pathname;
      var isAr = path.indexOf('/ar/') !== -1;

      if (targetLang === 'ar' && !isAr) {
        var lastSlashIdx = path.lastIndexOf('/');
        if (lastSlashIdx !== -1) {
          return path.substring(0, lastSlashIdx) + '/ar' + path.substring(lastSlashIdx);
        }
        return '/ar' + path;
      } else if (targetLang === 'en' && isAr) {
        return path.replace('/ar/', '/');
      }
    } catch (err) {
      console.error('Get redirect path error:', err);
    }
    return null;
  },

  translateRouterError: function() {
    try {
      var errorEl = document.getElementById('errorMessage');
      if (!errorEl) return;

      var currentLang = document.documentElement.getAttribute('lang') || 'en';
      var rawError = errorEl.getAttribute('data-raw-error') || errorEl.textContent.trim();
      
      if (!errorEl.getAttribute('data-raw-error')) {
        errorEl.setAttribute('data-raw-error', rawError);
      }

      if (!rawError) return;

      // Clean up URL encoding plus signs and formatting issues
      var cleanError = rawError.replace(/\+/g, ' ');
      
      // Decode percent encodings safely
      try {
        cleanError = decodeURIComponent(cleanError);
      } catch (e) {
        // Fallback: replace common encodings manually and strip any malformed hex patterns (e.g. %FFF)
        cleanError = cleanError.replace(/%2[fF]/g, '/')
                               .replace(/%20/g, ' ')
                               .replace(/%[a-zA-Z0-9]{2,}/g, '');
      }

      // Strip remaining sequence patterns of malformed %FFF or repeating % blocks
      cleanError = cleanError.replace(/(?:\s*[\/%]*[fF]{3,}[%]*)+/g, '')
                             .replace(/\s*\/[\s\/]*/g, ' ')
                             .replace(/\s+/g, ' ')
                             .trim();

      if (currentLang === 'ar') {
        errorEl.textContent = ui.mapRouterErrorToArabic(cleanError);
      } else {
        errorEl.textContent = cleanError;
      }
    } catch (err) {
      console.error('Translate router error error:', err);
    }
  },

  mapRouterErrorToArabic: function(error) {
    if (!error) return "";
    var err = error.toLowerCase();
    
    var dictionary = {
      // === 1. أخطاء الحساب وبيانات الدخول ===
      "invalid username or password": "اسم المستخدم أو كلمة المرور غير صحيحة.",
      "username or password wrong": "اسم المستخدم أو كلمة المرور غير صحيحة.",
      "invalid password": "كلمة المرور المدخلة غير صحيحة.",
      "invalid username": "اسم المستخدم غير صحيح.",
      "not found": "عذراً، هذا الحساب غير مسجل في نظامنا.",
      "doesn't exist": "عذراً، هذا الحساب غير مسجل في نظامنا.",
      "disabled": "هذا الحساب معطل حالياً، يرجى مراجعة إدارة الشبكة.",
      "not local": "هذا الحساب غير مسجل محلياً في خادم الشبكة.",

      // === 2. أخطاء الأجهزة المتعددة والـ MAC Address ===
      "already logged in": "جهازك مسجل دخول حالياً بالشبكة. لو حابب تسجل من جهاز تاني، افصل القديم أولاً.",
      "simultaneous": "جهازك مسجل دخول حالياً بالشبكة. لو حابب تسجل من جهاز تاني، افصل القديم أولاً.",
      "mac address is not yours": "عذراً، هذا الحساب مرتبط بجهاز آخر ولا يمكن استخدامه هنا.",
      "not allowed to log in from this mac": "غير مسموح بتسجيل الدخول من هذا الجهاز.",
      "no more sessions are allowed for user": "عذراً، لقد تم الوصول للحد الأقصى من الجلسات المفتوحة لهذا المستخدم.",

      // === 3. أخطاء انتهاء الاشتراكات وحجم البيانات ===
      "uptime limit reached": "انتهت صلاحية وقت الحساب المسموح بها.",
      "reached uptime limit": "انتهت صلاحية وقت الحساب المسموح بها.",
      "traffic limit reached": "لقد استهلكت كامل سعة التحميل المتاحة لحسابك.",
      "reached traffic limit": "لقد استهلكت كامل سعة التحميل المتاحة لحسابك.",
      "profile": "انتهت صلاحية الباقة الخاصة بك أو لا توجد باقة نشطة.",
      "active profile": "انتهت صلاحية الباقة الخاصة بك أو لا توجد باقة نشطة.",
      "no valid profile": "انتهت صلاحية باقة الاشتراك الحالية.",
      "credit limit reached": "انتهى رصيد حسابك، يرجى تجديد الاشتراك.",

      // === 4. أخطاء الفترة التجريبية (Trial Mode) ===
      "trial time limit reached": "انتهت الفترة التجريبية المجانية المتاحة لجهازك اليوم.",
      "trial limit reached": "لقد استهلكت فترة التجربة المجانية المتاحة لك.",

      // === 5. أخطاء الشبكة والاتصال بالخوادم ===
      "responding": "خادم الشبكة لا يستجيب حالياً، يرجى المحاولة لاحقاً.",
      "already authorizing": "جاري التحقق من الحساب بالفعل، يرجى المحاولة لاحقاً.",
      "radius server is not responding": "خادم التحقق (RADIUS) لا يستجيب، يرجى المحاولة لاحقاً.",
      "internal-error": "حدث خطأ داخلي في النظام، يرجى إبلاغ الإدارة.",
      "ippool-empty": "الشبكة ممتلئة بالكامل حالياً، يرجى الانتظار والمحاولة لاحقاً.",
      "no more free addresses": "الشبكة ممتلئة بالكامل حالياً، يرجى الانتظار والمحاولة لاحقاً."
    };

    for (var keyword in dictionary) {
      if (dictionary.hasOwnProperty(keyword) && err.indexOf(keyword) !== -1) {
        return dictionary[keyword];
      }
    }

    return error;
  },



  initCountdown: function(seconds, elementId, callback) {
    try {
      var element = document.getElementById(elementId);
      if (!element || !seconds) return;

      var remaining = seconds;
      element.textContent = util.formatTime(remaining);

      var interval = setInterval(function() {
        remaining--;
        element.textContent = util.formatTime(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          if (callback) callback();
        }
      }, 1000);

      return interval;
    } catch (err) {
      console.error('Init countdown error:', err);
      return null;
    }
  },

  showAlert: function(message, type) {
    try {
      var alertsContainer = document.getElementById('alerts');
      if (!alertsContainer) return;

      var alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-' + type;
      alertDiv.setAttribute('role', 'alert');

      var iconSvg = '';
      if (type === 'error') {
        iconSvg = '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      } else if (type === 'warning') {
        iconSvg = '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      } else {
        iconSvg = '<svg class="alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      }

      alertDiv.innerHTML = iconSvg + '<span class="alert__text">' + util.escapeHtml(message) + '</span>';
      alertsContainer.appendChild(alertDiv);
    } catch (err) {
      console.error('Show alert error:', err);
    }
  },

  toggleSupportModal: function() {
    try {
      var modal = document.getElementById('supportModal');
      if (!modal) return;
      
      var isOpen = modal.classList.contains('support-modal--open');
      if (isOpen) {
        modal.classList.remove('support-modal--open');
        if (ui._onSupportModalEsc) {
          document.removeEventListener('keydown', ui._onSupportModalEsc);
        }
      } else {
        modal.classList.add('support-modal--open');
        ui._onSupportModalEsc = function(e) {
          if (e.key === 'Escape' || e.keyCode === 27) {
            ui.toggleSupportModal();
          }
        };
        document.addEventListener('keydown', ui._onSupportModalEsc);
      }
    } catch (err) {
      console.error('Toggle support modal error:', err);
    }
  },

  closeSupportModalOnClickOutside: function(event) {
    try {
      var modal = document.getElementById('supportModal');
      if (modal && event.target === modal) {
        ui.toggleSupportModal();
      }
    } catch (err) {
      console.error('Close support modal click outside error:', err);
    }
  },

  initBackground: function() {
    try {
      var canvas = document.getElementById('network-bg');
      if (!canvas) return;

      var ctx = canvas.getContext('2d');
      var particles = [];
      var maxParticles = window.innerWidth < 768 ? 45 : 90;
      var connectionDistance = 100;
      var mouse = { x: null, y: null, radius: 130 };

      // Set canvas size
      var resizeCanvas = function() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        maxParticles = window.innerWidth < 768 ? 45 : 90;
      };
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      // Track mouse/touch movement
      var handleMove = function(e) {
        var clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        var clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
        if (clientX !== undefined && clientY !== undefined) {
          mouse.x = clientX;
          mouse.y = clientY;
        }
      };
      var handleLeave = function() {
        mouse.x = null;
        mouse.y = null;
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('mouseleave', handleLeave);
      window.addEventListener('touchend', handleLeave);

      // Particle Constructor
      var Particle = function() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 2 + 1;
      };

      Particle.prototype.update = function() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce on boundaries
        if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
        if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;

        // Mouse attraction/pull
        if (mouse.x !== null && mouse.y !== null) {
          var dx = mouse.x - this.x;
          var dy = mouse.y - this.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            var force = (mouse.radius - dist) / mouse.radius;
            this.x -= dx * force * 0.02;
            this.y -= dy * force * 0.02;
          }
        }
      };

      Particle.prototype.draw = function() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        var theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (theme === 'light') {
          ctx.fillStyle = 'rgba(79, 70, 229, 0.35)'; /* light mode: indigo nodes */
        } else {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; /* dark mode: blue glowing nodes */
        }
        ctx.fill();
      };

      // Populate particles
      for (var i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
      }

      // Animation Loop
      var fpsInterval = 1000 / 30; // Limit to 30 FPS for mobile power saving and performance
      var lastDrawTime = Date.now();

      var animate = function() {
        if (!canvas || !ctx) return;
        requestAnimationFrame(animate);

        var now = Date.now();
        var elapsed = now - lastDrawTime;
        if (elapsed < fpsInterval) return;
        lastDrawTime = now - (elapsed % fpsInterval);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var theme = document.documentElement.getAttribute('data-theme') || 'dark';
        var isLight = theme === 'light';

        // Adjust counts on screen resize dynamically
        while (particles.length < maxParticles) {
          particles.push(new Particle());
        }
        if (particles.length > maxParticles) {
          particles.length = maxParticles;
        }

        // On small mobile devices, skip calculating inter-particle connections to save CPU
        var isMobile = window.innerWidth < 768;

        // Draw and update particles
        for (var i = 0; i < particles.length; i++) {
          var p1 = particles[i];
          p1.update();
          p1.draw();

          // Calculate connections (only on desktop screen sizes to optimize mobile CPU)
          if (!isMobile) {
            for (var j = i + 1; j < particles.length; j++) {
              var p2 = particles[j];
              var dx = p1.x - p2.x;
              var dy = p1.y - p2.y;
              var dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < connectionDistance) {
                var alpha = (1 - dist / connectionDistance) * 0.15;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                
                if (isLight) {
                  ctx.strokeStyle = 'rgba(148, 163, 184, ' + alpha + ')';
                } else {
                  ctx.strokeStyle = 'rgba(34, 197, 94, ' + alpha + ')';
                }
                
                ctx.lineWidth = 0.8;
                ctx.stroke();
              }
            }
          }

          // Draw connections to pointer
          if (mouse.x !== null && mouse.y !== null) {
            var dxPointer = p1.x - mouse.x;
            var dyPointer = p1.y - mouse.y;
            var distPointer = Math.sqrt(dxPointer * dxPointer + dyPointer * dyPointer);
            if (distPointer < mouse.radius) {
              var alphaPointer = (1 - distPointer / mouse.radius) * 0.25;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(mouse.x, mouse.y);
              
              if (isLight) {
                ctx.strokeStyle = 'rgba(79, 70, 229, ' + alphaPointer + ')'; /* light mode: indigo pointer lines */
              } else {
                ctx.strokeStyle = 'rgba(59, 130, 246, ' + alphaPointer + ')'; /* dark mode: blue glow pointer lines */
              }
              
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }

        requestAnimationFrame(animate);
      };

      animate();
    } catch (err) {
      console.error('Init background animation error:', err);
    }
  },

  loadAnnouncements: function() {
    try {
      var isArabicDir = window.location.pathname.indexOf('/ar/') !== -1;
      var url = isArabicDir ? '../announcements.json' : './announcements.json';

      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              var data = JSON.parse(xhr.responseText);
              if (!data || !data.active) return;

              var lang = document.documentElement.getAttribute('lang') || 'en';
              var message = lang === 'ar' ? data.message_ar : data.message_en;
              if (!message) return;

              // Support both single string or array of strings
              var messages = [];
              if (Object.prototype.toString.call(message) === '[object Array]') {
                messages = message;
              } else {
                messages = [message];
              }
              if (messages.length === 0) return;

              var banner = document.getElementById('announcement-banner');
              var textEl = document.getElementById('announcement-text');
              var iconEl = document.getElementById('announcement-icon');
              if (!banner || !textEl) return;

              textEl.textContent = messages[0];
              banner.className = 'announcement-banner';
              var type = data.type || 'warning';
              banner.classList.add('announcement-banner--' + type);

              if (iconEl) {
                if (type === 'warning') {
                  iconEl.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
                } else {
                  iconEl.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
                }
              }

              ui._currentAnnouncementMessage = messages[0];
              banner.style.display = 'flex';

              // Carousel rotation interval setup
              if (messages.length > 1) {
                ui._announcementItems = messages;
                ui._announcementIndex = 0;

                if (ui._announcementInterval) {
                  clearInterval(ui._announcementInterval);
                }

                ui._announcementInterval = setInterval(function() {
                  ui.rotateAnnouncements();
                }, 5000);
              }
            } catch (jsonErr) {
              console.error('Parse announcements JSON error:', jsonErr);
            }
          }
        }
      };
      xhr.send();
    } catch (err) {
      console.error('Load announcements error:', err);
    }
  },

  dismissAnnouncement: function() {
    try {
      var banner = document.getElementById('announcement-banner');
      if (banner) {
        banner.style.display = 'none';
      }
      if (ui._currentAnnouncementMessage) {
        util.setCookie('hotspot_dismissed_msg', ui._currentAnnouncementMessage, 7);
      }
    } catch (err) {
      console.error('Dismiss announcement error:', err);
    }
  },

  rotateAnnouncements: function() {
    try {
      var textEl = document.getElementById('announcement-text');
      if (!textEl || !ui._announcementItems || ui._announcementItems.length <= 1) return;

      textEl.classList.add('announcement-banner__text--hidden');

      setTimeout(function() {
        ui._announcementIndex = (ui._announcementIndex + 1) % ui._announcementItems.length;
        textEl.textContent = ui._announcementItems[ui._announcementIndex];
        textEl.classList.remove('announcement-banner__text--hidden');
      }, 300);
    } catch (err) {
      console.error('Rotate announcements error:', err);
    }
  },

  toggleInstallModal: function() {
    try {
      var modal = document.getElementById('installModal');
      if (!modal) return;

      var isOpen = modal.classList.contains('support-modal--open');
      if (isOpen) {
        modal.classList.remove('support-modal--open');
        if (ui._onInstallModalEsc) {
          document.removeEventListener('keydown', ui._onInstallModalEsc);
        }
      } else {
        var ua = navigator.userAgent.toLowerCase();
        var isIos = /iphone|ipad|ipod/.test(ua);
        var isAndroid = /android/.test(ua);

        var iosGuide = document.getElementById('ios-guide');
        var androidGuide = document.getElementById('android-guide');
        var genericGuide = document.getElementById('generic-guide');

        if (iosGuide && androidGuide && genericGuide) {
          iosGuide.style.display = 'none';
          androidGuide.style.display = 'none';
          genericGuide.style.display = 'none';

          if (isIos) {
            iosGuide.style.display = 'flex';
          } else if (isAndroid) {
            androidGuide.style.display = 'flex';
          } else {
            genericGuide.style.display = 'flex';
          }
        }

        modal.classList.add('support-modal--open');
        ui._onInstallModalEsc = function(e) {
          if (e.key === 'Escape' || e.keyCode === 27) {
            ui.toggleInstallModal();
          }
        };
        document.addEventListener('keydown', ui._onInstallModalEsc);
      }
    } catch (err) {
      console.error('Toggle install modal error:', err);
    }
  },

  closeInstallModalOnClickOutside: function(event) {
    try {
      var modal = document.getElementById('installModal');
      if (modal && event.target === modal) {
        ui.toggleInstallModal();
      }
    } catch (err) {
      console.error('Close install modal click outside error:', err);
    }
  }
};

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ui;
}