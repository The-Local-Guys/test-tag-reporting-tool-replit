import posthog from 'posthog-js';

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

export function initPostHog(): void {
  if (isInitialized || typeof window === 'undefined') return;

  if (!POSTHOG_API_KEY) {
    console.warn('[PostHog] API key not configured. Analytics disabled.');
    return;
  }

  try {
    posthog.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage',
      bootstrap: {
        distinctID: getOrCreateSessionId(),
      },
    });

    setupErrorTracking();
    setupClickTracking();
    setupFormTracking();

    isInitialized = true;
    console.log('[PostHog] Frontend analytics initialized');
  } catch (error) {
    console.error('[PostHog] Failed to initialize:', error);
  }
}

function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem('posthog_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('posthog_session_id', sessionId);
  }
  return sessionId;
}

export function identifyUser(userId: number | string, properties?: Record<string, any>): void {
  if (!isInitialized) return;

  const distinctId = `user_${userId}`;
  posthog.identify(distinctId, {
    userId,
    ...properties,
  });

  localStorage.setItem('posthog_user_id', String(userId));
}

export function resetUser(): void {
  if (!isInitialized) return;
  
  posthog.reset();
  localStorage.removeItem('posthog_user_id');
}

export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  if (!isInitialized) return;

  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
    source: 'frontend',
    url: window.location.href,
    path: window.location.pathname,
  });
}

export function trackPageView(pageName?: string): void {
  if (!isInitialized) return;

  posthog.capture('$pageview', {
    pageName: pageName || document.title,
    path: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer,
    timestamp: new Date().toISOString(),
  });
}

export function trackLogin(userId: number | string, username: string, role?: string): void {
  identifyUser(userId, { username, role });
  trackEvent('user_login', { userId, username, role });
}

export function trackLogout(): void {
  trackEvent('user_logout');
  resetUser();
}

export function trackSessionStart(sessionData: Record<string, any>): void {
  trackEvent('test_session_started', sessionData);
}

export function trackSessionComplete(sessionData: Record<string, any>): void {
  trackEvent('test_session_completed', sessionData);
}

export function trackTestResult(
  testType: string,
  result: 'pass' | 'fail',
  itemData?: Record<string, any>
): void {
  trackEvent('test_result_recorded', {
    testType,
    result,
    ...itemData,
  });
}

export function trackReportPreview(sessionData: Record<string, any>): void {
  trackEvent('report_preview_opened', sessionData);
}

export function trackReportDownload(format: 'pdf' | 'excel', sessionData: Record<string, any>): void {
  trackEvent('report_downloaded', {
    format,
    ...sessionData,
  });
}

export function trackCertificateAction(
  action: 'created' | 'updated' | 'deleted' | 'downloaded' | 'previewed',
  certificateData?: Record<string, any>
): void {
  trackEvent(`certificate_${action}`, certificateData);
}

export function trackNavigation(from: string, to: string): void {
  trackEvent('navigation', { from, to });
}

export function trackButtonClick(buttonName: string, context?: Record<string, any>): void {
  trackEvent('button_click', { buttonName, ...context });
}

export function trackFormSubmit(formName: string, success: boolean, data?: Record<string, any>): void {
  trackEvent('form_submit', { formName, success, ...data });
}

export function trackError(error: Error | string, context?: Record<string, any>): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  trackEvent('frontend_error', {
    error: errorMessage,
    stack: errorStack,
    ...context,
  });
}

function setupErrorTracking(): void {
  window.addEventListener('error', (event) => {
    trackEvent('javascript_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    trackEvent('unhandled_promise_rejection', {
      reason: String(event.reason),
    });
  });
}

function setupClickTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    const isInteractive = target.matches('button, a, [role="button"], input[type="submit"], [data-testid]');
    if (!isInteractive) return;

    const elementInfo = {
      tagName: target.tagName.toLowerCase(),
      id: target.id || undefined,
      className: target.className || undefined,
      text: target.innerText?.slice(0, 50) || undefined,
      testId: target.getAttribute('data-testid') || undefined,
      href: (target as HTMLAnchorElement).href || undefined,
    };

    posthog.capture('element_click', {
      ...elementInfo,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
    });
  }, { passive: true });
}

function setupFormTracking(): void {
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (!form) return;

    const formInfo = {
      formId: form.id || undefined,
      formName: form.name || undefined,
      formAction: form.action || undefined,
      formMethod: form.method || undefined,
    };

    posthog.capture('form_submission', {
      ...formInfo,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
    });
  }, { passive: true });
}

export function getPostHog() {
  return posthog;
}

export default posthog;
