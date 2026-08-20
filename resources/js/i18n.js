// resources/js/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Make i18n instance available for direct imports
export { default as i18next } from 'i18next';

// Custom backend to handle the modified response format
const customBackend = {
  type: 'backend',
  init: function(services, backendOptions) {
    this.services = services;
    this.options = backendOptions;
  },
  read: function(language, namespace, callback) {
    const loadPath = window.route ? window.route('translations', language) : `/translations/${language}`;
    
    fetch(loadPath)
      .then(response => response.json())
      .then(data => {
        // Extract translations from the structured response
        const translations = data.translations;
        
        // // Apply RTL/LTR direction immediately
        // const isRtl = data.layoutDirection === 'rtl';
        // const direction = isRtl ? 'rtl' : 'ltr';
        
        // // Apply direction to document
        // document.documentElement.dir = direction;
        // document.documentElement.setAttribute('dir', direction);
        // document.body.dir = direction;
        // document.body.setAttribute('dir', direction);
        
        // // Add/remove RTL class for CSS styling
        // if (isRtl) {
        //   document.documentElement.classList.add('rtl');
        //   document.body.classList.add('rtl');
        // } else {
        //   document.documentElement.classList.remove('rtl');
        //   document.body.classList.remove('rtl');
        // }
        
        // // Store the current locale with proper cookie settings
        // if (data.locale) {
        //   localStorage.setItem('i18nextLng', data.locale);
          
        //   // Store in cookies with proper expiration
        //   const cookieOptions = `path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        //   document.cookie = `app_language=${data.locale}; ${cookieOptions}`;
          
        //   // Store in demo-specific cookies if in demo mode
        //   if (data.isDemo) {
        //     document.cookie = `taskly_demo_language=${data.locale}; ${cookieOptions}`;
        //     document.cookie = `selected_language=${data.locale}; ${cookieOptions}`;
        //     document.cookie = `layoutDirection=${isRtl ? 'right' : 'left'}; ${cookieOptions}`;
        //   }
        // }
        
        // // Dispatch custom event for layout changes
        // window.dispatchEvent(new CustomEvent('languageDirectionChanged', {
        //   detail: { language: data.locale, direction, isRtl }
        // }));

        // Set document direction - always keep LTR for sidebar compatibility
        document.documentElement.dir = 'ltr';
        document.documentElement.setAttribute('dir', 'ltr');
        
        callback(null, translations);
      })
      .catch(error => {
        console.error('Translation loading error:', error);
        callback(error, null);
      });
  }
};

// Function to get initial language with improved detection
const getInitialLanguage = () => {
  // Try to get from server if available
  if (window.initialLocale) {
    return window.initialLocale;
  }
  
  // Check for cookies
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }
    return null;
  };
  
  // Try app language cookie first (used in demo mode)
  const appLang = getCookie('app_language');
  if (appLang) {
    return appLang;
  }
  
  // Try demo-specific cookies as fallback
  const demoLang = getCookie('taskly_demo_language') || getCookie('selected_language');
  if (demoLang) {
    return demoLang;
  }
  
  // Check localStorage
  const storedLang = localStorage.getItem('i18nextLng');
  if (storedLang && storedLang !== 'undefined') {
    return storedLang;
  }
  
  // Otherwise use browser detection with fallback to 'en'
  return null; // null will trigger language detection
};

// Initialize i18n
i18n
    .use(customBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        lng: getInitialLanguage(),
        fallbackLng: 'en',
        load: 'currentOnly',
        debug: process.env.NODE_ENV === 'development',
        
        interpolation: {
            escapeValue: false,
        },
        
        detection: {
          order: ['localStorage', 'cookie', 'navigator'],
          lookupCookie: 'app_language',
          caches: ['localStorage', 'cookie'],
        },
        
        ns: ['translation'],
        defaultNS: 'translation',
        
        partialBundledLanguages: true,
        loadOnInitialization: true,
        
        // Disable resource caching to ensure fresh translations
        saveMissing: false,
        updateMissing: false,
        
        react: {
            useSuspense: false,
            bindI18n: 'languageChanged loaded',
            bindI18nStore: 'added removed',
            transEmptyNodeValue: '',
            transSupportBasicHtmlNodes: true,
            transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
        }
    });

// Override changeLanguage to force resource reload
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = function(lng, callback) {
    // Remove cached resources for the new language
    if (i18n.services.resourceStore.data[lng]) {
        delete i18n.services.resourceStore.data[lng];
    }
    
    // Call original changeLanguage
    return originalChangeLanguage(lng, callback);
};

// Export the initialized instance
export default i18n;

// Make sure the i18n instance is available for direct imports
window.i18next = i18n;
