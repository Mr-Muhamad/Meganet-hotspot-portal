/**
 * presets.js — ready-made "place personality" bundles for the white-label
 * system (v2.5.0 theme-only presets; v2.7.0 three-dimensional presets).
 *
 * A preset is a starting point, not a lock: it fills theme defaults, a base
 * i18n dictionary and a welcome announcement ONLY when the operator has not
 * set those values explicitly in config.json. Explicit config always wins.
 *
 * Preset shape:
 *   label        — human description (shown in the admin UI)
 *   theme        — { defaultTheme, cardRadius, enableNetworkBackground }
 *   i18nOverrides— base client dictionary (operator keys win over these)
 *   announcement — suggested welcome banner (seeded into new profiles)
 *   preview      — UI-only metadata: sample colors + radius for the picker
 *
 * Custom (admin-saved) presets use ids prefixed `custom:` and are passed to
 * resolveEffectiveConfig as `extraPresets` — they never live in this file.
 */

'use strict';

const PRESETS = {
  meganet: {
    label: 'ميجا نت — دارك نيون أخضر، شبكة متحركة',
    theme: { defaultTheme: 'dark', cardRadius: '16px', enableNetworkBackground: true },
    i18nOverrides: {},
    announcement: null,
    preview: { colors: ['#22c55e', '#020617'], radius: '16px' }
  },
  cafe: {
    label: 'كافيه — نهاري دافئ، حواف ودودة، هادي',
    theme: { defaultTheme: 'light', cardRadius: '24px', enableNetworkBackground: false },
    i18nOverrides: {
      voucher_label: 'كود القعدة',
      voucher_placeholder: 'اكتب كود القعدة هنا',
      login_button: { en: 'Get Online', ar: 'افتح النت' },
      plans_link: { en: 'See our offers', ar: 'شوف عروضنا' },
      support_title: { en: 'Ask the barista', ar: 'اسأل الكاشير' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome to our café ☕ Enjoy your seat with fast WiFi on us.', 'Ask the cashier for your table code.'],
      message_ar: ['أهلاً بيك في قهوتنا ☕ استمتع بقعدتك وإنترنت سريع على حسابنا.', 'اسأل الكاشير عن كود القعدة.']
    },
    preview: { colors: ['#A9713C', '#FFF6EC'], radius: '24px' }
  },
  hotel: {
    label: 'فندق — دارك فخم، حواف حادة، راقي',
    theme: { defaultTheme: 'dark', cardRadius: '12px', enableNetworkBackground: true },
    i18nOverrides: {
      voucher_label: 'رقم الغرفة',
      voucher_placeholder: 'اكتب رقم الغرفة',
      login_button: { en: 'Welcome', ar: 'أهلاً بكم' },
      plans_link: { en: 'Our suites', ar: 'السويتات' },
      support_title: { en: 'Guest services', ar: 'خدمة الغرف' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome to our hotel — we wish you a pleasant stay.', 'Room WiFi is complimentary.'],
      message_ar: ['أهلاً بكم في فندقنا — نتمنى لكم إقامة سعيدة.', 'الواي فاي داخل الغرف مجاني.']
    },
    preview: { colors: ['#C9A227', '#101826'], radius: '12px' }
  },
  clinic: {
    label: 'عيادة — نهاري نظيف، واضح وهادي',
    theme: { defaultTheme: 'light', cardRadius: '18px', enableNetworkBackground: false },
    i18nOverrides: {
      voucher_label: 'كود الزيارة',
      voucher_placeholder: 'اكتب كود الزيارة',
      login_button: { en: 'Connect', ar: 'دخول' },
      plans_link: { en: 'Our services', ar: 'خدماتنا' },
      support_title: { en: 'Reception', ar: 'الاستقبال' }
    },
    announcement: {
      active: true,
      type: 'info',
      message_en: ['Welcome — we wish you good health.', 'Your visit code is on your appointment slip.'],
      message_ar: ['أهلاً بكم — نتمنى لكم دوام الصحة والعافية.', 'كود الزيارة موجود على ورق الحجز.']
    },
    preview: { colors: ['#0e7490', '#f0f9ff'], radius: '18px' }
  },
  restaurant: {
    label: 'مطعم — دارك دافئ، عائلي',
    theme: { defaultTheme: 'dark', cardRadius: '20px', enableNetworkBackground: true },
    i18nOverrides: {
      voucher_label: 'كود الحجز',
      voucher_placeholder: 'اكتب كود الحجز',
      login_button: { en: 'Get Online', ar: 'اتصل بالنت' },
      plans_link: { en: 'Our menu', ar: 'قائمتنا' },
      support_title: { en: 'Ask the waiter', ar: 'اسأل الجرسون' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome — enjoy your meal!', 'Ask your waiter for the table WiFi code.'],
      message_ar: ['أهلاً بكم — بالهنا والشفا!', 'اسأل الجرسون عن كود واي فاي الطاولة.']
    },
    preview: { colors: ['#B3402A', '#1C1008'], radius: '20px' }
  },
  gym: {
    label: 'جيم — دارك حاد، طاقة وحزم',
    theme: { defaultTheme: 'dark', cardRadius: '8px', enableNetworkBackground: true },
    i18nOverrides: {
      voucher_label: 'رقم الاشتراك',
      voucher_placeholder: 'اكتب رقم الاشتراك',
      login_button: { en: 'Start Training', ar: 'ابدأ تمرينك' },
      plans_link: { en: 'Memberships', ar: 'الاشتراكات' },
      support_title: { en: 'Front desk', ar: 'الريسبشن' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ["Let's go — progress is power!", 'Your membership number is on your card.'],
      message_ar: ['يلا نبدأ — قوتك في التقدم!', 'رقم الاشتراك على كارتك.']
    },
    preview: { colors: ['#F97316', '#0A0A0A'], radius: '8px' }
  },
  netcafe: {
    label: 'كافيه نت / جيمنج — دارك نيون تقني',
    theme: { defaultTheme: 'dark', cardRadius: '14px', enableNetworkBackground: true },
    i18nOverrides: {
      voucher_label: 'كود الجهاز',
      voucher_placeholder: 'اكتب كود الجهاز',
      login_button: { en: 'Enter Game', ar: 'ادخل ولعب' },
      plans_link: { en: 'Rates', ar: 'الأسعار' },
      support_title: { en: 'The admin', ar: 'الأدمن' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome — ready to play?', 'Your device code is on the screen card.'],
      message_ar: ['أهلاً بيك — استعد للعب!', 'كود الجهاز على كارت الشاشة.']
    },
    preview: { colors: ['#8B5CF6', '#09090F'], radius: '14px' }
  },
  mall: {
    label: 'مول — نهاري تجاري نظيف',
    theme: { defaultTheme: 'light', cardRadius: '12px', enableNetworkBackground: false },
    i18nOverrides: {
      voucher_label: 'كود الزيارة',
      voucher_placeholder: 'اكتب كود الزيارة',
      login_button: { en: 'Connect', ar: 'اتصل' },
      plans_link: { en: 'Directory', ar: 'دليل المحلات' },
      support_title: { en: 'Guest desk', ar: 'كيسك الزوار' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome to the mall — happy shopping!', 'Free WiFi courtesy of the mall management.'],
      message_ar: ['أهلاً بكم في المول — تسوق سعيد!', 'الواي فاي مجاني من إدارة المول.']
    },
    preview: { colors: ['#2563EB', '#F8FAFC'], radius: '12px' }
  },
  school: {
    label: 'مدرسة/جامعة — نهاري مؤسسي',
    theme: { defaultTheme: 'light', cardRadius: '10px', enableNetworkBackground: false },
    i18nOverrides: {
      voucher_label: 'الرقم الأكاديمي',
      voucher_placeholder: 'اكتب رقمك الأكاديمي',
      login_button: { en: 'Sign In', ar: 'دخول الطالب' },
      plans_link: { en: 'Courses', ar: 'المقررات' },
      support_title: { en: 'IT support', ar: 'الدعم الفني' }
    },
    announcement: {
      active: true,
      type: 'info',
      message_en: ['Welcome, students — good luck with your studies.', 'Use your academic ID to connect.'],
      message_ar: ['أهلاً بطلابنا — بالتوفيق في دراستكم.', 'استخدم رقمك الأكاديمي للاتصال.']
    },
    preview: { colors: ['#1D4ED8', '#EFF6FF'], radius: '10px' }
  },
  coworking: {
    label: 'مساحة عمل — نهاري عصري عملي',
    theme: { defaultTheme: 'light', cardRadius: '16px', enableNetworkBackground: false },
    i18nOverrides: {
      voucher_label: 'كود العضوية',
      voucher_placeholder: 'اكتب كود العضوية',
      login_button: { en: 'Start Work', ar: 'ابدأ شغلك' },
      plans_link: { en: 'Memberships', ar: 'العضويات' },
      support_title: { en: 'Community manager', ar: 'مسؤول المساحة' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome to your workspace — have a productive day.', 'Your membership code is at the front desk.'],
      message_ar: ['أهلاً بيك في مساحتك — يوم إنتاجي سعيد.', 'كود العضوية عند الريسبشن.']
    },
    preview: { colors: ['#0D9488', '#F0FDFA'], radius: '16px' }
  },
  bakery: {
    label: 'مخبز/حلواني — نهاري بيوتي دافئ',
    theme: { defaultTheme: 'light', cardRadius: '26px', enableNetworkBackground: false },
    i18nOverrides: {
      voucher_label: 'كود الطلب',
      voucher_placeholder: 'اكتب كود الطلب',
      login_button: { en: 'Get Online', ar: 'اتصل بالواي فاي' },
      plans_link: { en: 'Our sweets', ar: 'حلوياتنا' },
      support_title: { en: 'Ask the counter', ar: 'اسأل الكاشير' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome — fresh from the oven!', 'Ask for your order WiFi code at the counter.'],
      message_ar: ['أهلاً بيك — طازة من الفرن!', 'اسأل الكاشير عن كود واي فاي طلبك.']
    },
    preview: { colors: ['#D97706', '#FFFBEB'], radius: '26px' }
  },
  'mobile-shop': {
    label: 'محل موبايلات — دارك تقني حاد',
    theme: { defaultTheme: 'dark', cardRadius: '10px', enableNetworkBackground: true },
    i18nOverrides: {
      voucher_label: 'رقم الكارت',
      voucher_placeholder: 'اكتب رقم الكارت',
      login_button: { en: 'Activate', ar: 'تفعيل' },
      plans_link: { en: 'Charging cards', ar: 'كروت الشحن' },
      support_title: { en: 'The shop', ar: 'المحل' }
    },
    announcement: {
      active: true,
      type: 'promo',
      message_en: ['Welcome — activate your card and get online.', 'Charging cards available at the shop.'],
      message_ar: ['أهلاً بيك — فعّل كارتك واتصل.', 'كروت الشحن متاحة في المحل.']
    },
    preview: { colors: ['#06B6D4', '#0C1420'], radius: '10px' }
  }
};

const BUILTIN_PRESET_IDS = Object.keys(PRESETS);
const CUSTOM_PRESET_RE = /^custom:[a-z0-9-]{1,40}$/;

/**
 * Resolve the EFFECTIVE config = raw config.json + preset defaults where the
 * operator left values unset. Custom (admin-saved) presets can be passed via
 * `extraPresets` (map of id → preset). Never mutates the caller's object.
 */
function resolveEffectiveConfig(raw, extraPresets) {
  const config = JSON.parse(JSON.stringify(raw || {}));
  const presetName = config.theme && config.theme.preset;
  const preset = presetName
    ? (PRESETS[presetName] || (extraPresets && extraPresets[presetName]) || null)
    : null;
  if (!preset) return config;

  // Theme defaults: fill only unset fields (hints/_hints stay untouched).
  config.theme = config.theme || {};
  for (const [key, value] of Object.entries(preset.theme || {})) {
    if (config.theme[key] === undefined || config.theme[key] === null) {
      config.theme[key] = value;
    }
  }

  // i18n overrides: preset dictionary is the base; explicit operator keys win.
  const operatorOverrides = config.i18nOverrides || {};
  config.i18nOverrides = Object.assign({}, preset.i18nOverrides || {}, operatorOverrides);

  return config;
}

module.exports = {
  PRESETS,
  BUILTIN_PRESET_IDS,
  CUSTOM_PRESET_RE,
  resolveEffectiveConfig
};
