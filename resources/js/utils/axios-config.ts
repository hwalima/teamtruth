import axios from 'axios';

// Set CSRF token for all requests
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Intercept requests to add fresh CSRF token
axios.interceptors.request.use((config) => {
  let csrfToken = null;
  
  // Try to get CSRF token from meta tag first (most reliable)
  const metaToken = document.head.querySelector('meta[name="csrf-token"]');
  if (metaToken) {
    csrfToken = (metaToken as HTMLMetaElement).content;
  }
  
  // Override with Inertia token if available (fresher after login)
  try {
    if (typeof window !== 'undefined' && (window as any).page?.props?.csrf_token) {
      csrfToken = (window as any).page.props.csrf_token;
    }
  } catch (e) {
    // Ignore errors accessing window.page
  }
  
  if (csrfToken) {
    config.headers['X-CSRF-TOKEN'] = csrfToken;
  }

  // Ask browser and intermediary caches to revalidate app requests so stale
  // HTML cannot be reused for session-bound Inertia visits or form submissions.
  if (typeof window !== 'undefined' && config.url) {
    const requestUrl = new URL(config.url, config.baseURL || window.location.href);
    if (requestUrl.origin === window.location.origin) {
      config.headers['Cache-Control'] = 'no-cache, no-store, max-age=0';
      config.headers['Pragma'] = 'no-cache';
    }
  }

  return config;
});

export default axios;