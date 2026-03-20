import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

// Detect system language
function detectSystemLanguage() {
  if (typeof navigator === 'undefined') return 'zh-CN';

  const systemLang = navigator.language || navigator.userLanguage || 'zh-CN';

  // Map system language codes to our supported languages
  if (systemLang.startsWith('zh')) return 'zh-CN';
  if (systemLang.startsWith('en')) return 'en';

  // Default to Chinese for unsupported languages
  return 'zh-CN';
}

// Get saved language or detect from system
function getInitialLanguage() {
  const saved = localStorage.getItem('language');
  if (saved && ['zh-CN', 'en'].includes(saved)) return saved;
  return detectSystemLanguage();
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'zh-CN',
    interpolation: { escapeValue: false },
  });

export default i18n;
