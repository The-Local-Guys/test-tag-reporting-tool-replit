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
    setupInputTracking();
    setupScrollTracking();
    setupVisibilityTracking();
    setupKeyboardTracking();
    setupClipboardTracking();
    setupModalTracking();
    setupSelectTracking();
    setupTabTracking();

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

function getStoredUserInfo(): Record<string, any> {
  try {
    const userId = localStorage.getItem('posthog_user_id');
    const userInfo = localStorage.getItem('posthog_user_info');
    if (userInfo) {
      return JSON.parse(userInfo);
    }
    return { userId: userId || null };
  } catch {
    return {};
  }
}

export function identifyUser(userId: number | string, properties?: Record<string, any>): void {
  if (!isInitialized) return;

  const distinctId = `user_${userId}`;
  const userProps = {
    userId,
    ...properties,
    lastSeenAt: new Date().toISOString(),
  };

  posthog.identify(distinctId, userProps);

  localStorage.setItem('posthog_user_id', String(userId));
  localStorage.setItem('posthog_user_info', JSON.stringify(userProps));
}

export function resetUser(): void {
  if (!isInitialized) return;
  
  posthog.reset();
  localStorage.removeItem('posthog_user_id');
  localStorage.removeItem('posthog_user_info');
}

export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  if (!isInitialized) return;

  const userInfo = getStoredUserInfo();

  posthog.capture(eventName, {
    ...properties,
    ...userInfo,
    $timestamp: new Date().toISOString(),
    source: 'frontend',
    url: window.location.href,
    path: window.location.pathname,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  });
}

export function trackPageView(pageName?: string): void {
  if (!isInitialized) return;

  const userInfo = getStoredUserInfo();

  posthog.capture('$pageview', {
    ...userInfo,
    pageName: pageName || document.title,
    path: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer,
    $timestamp: new Date().toISOString(),
  });
}

export function trackLogin(userId: number | string, username: string, role?: string): void {
  const loginProps = { 
    userId, 
    username, 
    role,
    loginMethod: 'password',
    loginTime: new Date().toISOString(),
  };
  
  identifyUser(userId, loginProps);
  trackEvent('user_login', loginProps);
}

export function trackLogout(): void {
  const userInfo = getStoredUserInfo();
  trackEvent('user_logout', {
    ...userInfo,
    logoutTime: new Date().toISOString(),
  });
  resetUser();
}

export function trackSessionStart(sessionData: Record<string, any>): void {
  trackEvent('test_session_started', {
    ...sessionData,
    sessionStartTime: new Date().toISOString(),
  });
}

export function trackSessionComplete(sessionData: Record<string, any>): void {
  trackEvent('test_session_completed', {
    ...sessionData,
    sessionCompleteTime: new Date().toISOString(),
  });
}

export function trackSessionCancelled(sessionData: Record<string, any>): void {
  trackEvent('test_session_cancelled', {
    ...sessionData,
    cancelTime: new Date().toISOString(),
  });
}

export function trackTestResult(
  testType: string,
  result: 'pass' | 'fail',
  itemData?: Record<string, any>
): void {
  trackEvent('test_result_recorded', {
    testType,
    result,
    isPassing: result === 'pass',
    recordedAt: new Date().toISOString(),
    ...itemData,
  });
}

export function trackItemAdded(serviceType: string, itemData: Record<string, any>): void {
  trackEvent('test_item_added', {
    serviceType,
    ...itemData,
    addedAt: new Date().toISOString(),
  });
}

export function trackItemDeleted(serviceType: string, itemData: Record<string, any>): void {
  trackEvent('test_item_deleted', {
    serviceType,
    ...itemData,
    deletedAt: new Date().toISOString(),
  });
}

export function trackReportPreview(sessionData: Record<string, any>): void {
  trackEvent('report_preview_opened', {
    ...sessionData,
    previewTime: new Date().toISOString(),
  });
}

export function trackReportDownload(format: 'pdf' | 'excel', sessionData: Record<string, any>): void {
  trackEvent('report_downloaded', {
    format,
    ...sessionData,
    downloadTime: new Date().toISOString(),
  });
}

export function trackCertificateAction(
  action: 'created' | 'updated' | 'deleted' | 'downloaded' | 'previewed' | 'modal_opened' | 'modal_closed',
  certificateData?: Record<string, any>
): void {
  trackEvent(`certificate_${action}`, {
    ...certificateData,
    actionTime: new Date().toISOString(),
  });
}

export function trackEnvironmentAction(
  action: 'selected' | 'created' | 'updated' | 'deleted',
  environmentData?: Record<string, any>
): void {
  trackEvent(`environment_${action}`, {
    ...environmentData,
    actionTime: new Date().toISOString(),
  });
}

export function trackNavigation(from: string, to: string, method: 'click' | 'programmatic' = 'click'): void {
  trackEvent('navigation', { 
    from, 
    to, 
    method,
    navigationTime: new Date().toISOString(),
  });
}

export function trackButtonClick(buttonName: string, context?: Record<string, any>): void {
  trackEvent('button_click', { 
    buttonName, 
    ...context,
    clickTime: new Date().toISOString(),
  });
}

export function trackFormSubmit(formName: string, success: boolean, data?: Record<string, any>): void {
  trackEvent('form_submit', { 
    formName, 
    success, 
    ...data,
    submitTime: new Date().toISOString(),
  });
}

export function trackFormValidationError(formName: string, fieldErrors: Record<string, string>): void {
  trackEvent('form_validation_error', {
    formName,
    fieldErrors,
    errorCount: Object.keys(fieldErrors).length,
    errorTime: new Date().toISOString(),
  });
}

export function trackModalOpen(modalName: string, context?: Record<string, any>): void {
  trackEvent('modal_opened', {
    modalName,
    ...context,
    openTime: new Date().toISOString(),
  });
}

export function trackModalClose(modalName: string, closeReason: 'submit' | 'cancel' | 'backdrop' | 'escape' = 'cancel'): void {
  trackEvent('modal_closed', {
    modalName,
    closeReason,
    closeTime: new Date().toISOString(),
  });
}

export function trackTabChange(tabName: string, previousTab?: string): void {
  trackEvent('tab_changed', {
    tabName,
    previousTab,
    changeTime: new Date().toISOString(),
  });
}

export function trackDropdownSelect(dropdownName: string, selectedValue: string, previousValue?: string): void {
  trackEvent('dropdown_selected', {
    dropdownName,
    selectedValue,
    previousValue,
    selectTime: new Date().toISOString(),
  });
}

export function trackCheckboxToggle(checkboxName: string, checked: boolean): void {
  trackEvent('checkbox_toggled', {
    checkboxName,
    checked,
    toggleTime: new Date().toISOString(),
  });
}

export function trackSearchPerformed(searchQuery: string, resultCount?: number, context?: string): void {
  trackEvent('search_performed', {
    searchQuery: searchQuery.substring(0, 100),
    resultCount,
    context,
    searchTime: new Date().toISOString(),
  });
}

export function trackFileUpload(fileName: string, fileSize: number, fileType: string, success: boolean): void {
  trackEvent('file_uploaded', {
    fileName,
    fileSize,
    fileType,
    success,
    uploadTime: new Date().toISOString(),
  });
}

export function trackError(error: Error | string, context?: Record<string, any>): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  trackEvent('frontend_error', {
    error: errorMessage,
    stack: errorStack,
    ...context,
    errorTime: new Date().toISOString(),
  });
}

export function trackAPICall(
  endpoint: string,
  method: string,
  success: boolean,
  duration: number,
  statusCode?: number
): void {
  trackEvent('api_call', {
    endpoint,
    method,
    success,
    duration,
    statusCode,
    callTime: new Date().toISOString(),
  });
}

export function trackServiceTypeSelected(serviceType: string): void {
  trackEvent('service_type_selected', {
    serviceType,
    selectTime: new Date().toISOString(),
  });
}

export function trackCountrySelected(country: string, serviceType?: string): void {
  trackEvent('country_selected', {
    country,
    serviceType,
    selectTime: new Date().toISOString(),
  });
}

export function trackFrequencySelected(frequency: string, serviceType?: string): void {
  trackEvent('frequency_selected', {
    frequency,
    serviceType,
    selectTime: new Date().toISOString(),
  });
}

export function trackClassificationSelected(classification: string): void {
  trackEvent('classification_selected', {
    classification,
    selectTime: new Date().toISOString(),
  });
}

export function trackAssetNumberChanged(assetNumber: string, method: 'auto' | 'manual'): void {
  trackEvent('asset_number_changed', {
    assetNumber,
    method,
    changeTime: new Date().toISOString(),
  });
}

export function trackPhotoCapture(success: boolean, context?: string): void {
  trackEvent('photo_captured', {
    success,
    context,
    captureTime: new Date().toISOString(),
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
      errorType: 'runtime',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    trackEvent('unhandled_promise_rejection', {
      reason: String(event.reason),
      errorType: 'promise',
    });
  });
}

function setupClickTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    const isInteractive = target.matches('button, a, [role="button"], input[type="submit"], [data-testid]');
    if (!isInteractive) return;

    const closestButton = target.closest('button, a, [role="button"]');
    const element = closestButton || target;

    const elementInfo = {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: typeof element.className === 'string' ? element.className.split(' ').slice(0, 3).join(' ') : undefined,
      text: (element as HTMLElement).innerText?.slice(0, 50) || undefined,
      testId: element.getAttribute('data-testid') || undefined,
      href: (element as HTMLAnchorElement).href || undefined,
      ariaLabel: element.getAttribute('aria-label') || undefined,
      disabled: (element as HTMLButtonElement).disabled || undefined,
    };

    posthog.capture('element_click', {
      ...elementInfo,
      path: window.location.pathname,
      $timestamp: new Date().toISOString(),
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
      inputCount: form.querySelectorAll('input, select, textarea').length,
    };

    posthog.capture('form_submission', {
      ...formInfo,
      path: window.location.pathname,
      $timestamp: new Date().toISOString(),
    });
  }, { passive: true });
}

function setupInputTracking(): void {
  let focusStartTime: number | null = null;
  let lastFocusedElement: HTMLElement | null = null;

  document.addEventListener('focusin', (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches('input, textarea, select')) return;

    focusStartTime = Date.now();
    lastFocusedElement = target;

    const inputType = (target as HTMLInputElement).type || target.tagName.toLowerCase();
    const testId = target.getAttribute('data-testid');

    posthog.capture('input_focus', {
      inputType,
      inputId: target.id || undefined,
      inputName: (target as HTMLInputElement).name || undefined,
      testId,
      path: window.location.pathname,
      $timestamp: new Date().toISOString(),
    });
  }, { passive: true });

  document.addEventListener('focusout', (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches('input, textarea, select')) return;
    if (target !== lastFocusedElement) return;

    const focusDuration = focusStartTime ? Date.now() - focusStartTime : 0;
    const inputType = (target as HTMLInputElement).type || target.tagName.toLowerCase();
    const hasValue = !!(target as HTMLInputElement).value;

    posthog.capture('input_blur', {
      inputType,
      inputId: target.id || undefined,
      inputName: (target as HTMLInputElement).name || undefined,
      testId: target.getAttribute('data-testid') || undefined,
      focusDuration,
      hasValue,
      path: window.location.pathname,
      $timestamp: new Date().toISOString(),
    });

    focusStartTime = null;
    lastFocusedElement = null;
  }, { passive: true });
}

function setupScrollTracking(): void {
  let scrollTimeout: ReturnType<typeof setTimeout>;
  let maxScrollDepth = 0;
  let lastScrollTime = Date.now();

  window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
    
    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;
    }

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollDuration = Date.now() - lastScrollTime;
      
      if (maxScrollDepth >= 25 && maxScrollDepth < 50) {
        posthog.capture('scroll_depth_25', { 
          path: window.location.pathname,
          scrollDuration,
        });
      } else if (maxScrollDepth >= 50 && maxScrollDepth < 75) {
        posthog.capture('scroll_depth_50', { 
          path: window.location.pathname,
          scrollDuration,
        });
      } else if (maxScrollDepth >= 75 && maxScrollDepth < 100) {
        posthog.capture('scroll_depth_75', { 
          path: window.location.pathname,
          scrollDuration,
        });
      } else if (maxScrollDepth >= 100) {
        posthog.capture('scroll_depth_100', { 
          path: window.location.pathname,
          scrollDuration,
        });
      }
      
      lastScrollTime = Date.now();
    }, 500);
  }, { passive: true });
}

function setupVisibilityTracking(): void {
  let hiddenTime: number | null = null;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTime = Date.now();
      posthog.capture('page_hidden', {
        path: window.location.pathname,
        $timestamp: new Date().toISOString(),
      });
    } else {
      const hiddenDuration = hiddenTime ? Date.now() - hiddenTime : 0;
      posthog.capture('page_visible', {
        path: window.location.pathname,
        hiddenDuration,
        $timestamp: new Date().toISOString(),
      });
      hiddenTime = null;
    }
  });

  window.addEventListener('beforeunload', () => {
    posthog.capture('page_unload', {
      path: window.location.pathname,
      $timestamp: new Date().toISOString(),
    });
  });
}

function setupKeyboardTracking(): void {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      posthog.capture('escape_pressed', {
        path: window.location.pathname,
        activeElement: document.activeElement?.tagName,
        $timestamp: new Date().toISOString(),
      });
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      posthog.capture('keyboard_save', {
        path: window.location.pathname,
        $timestamp: new Date().toISOString(),
      });
    }

    if (event.key === 'Enter' && document.activeElement?.matches('input, textarea')) {
      posthog.capture('enter_pressed', {
        inputType: (document.activeElement as HTMLInputElement).type,
        inputId: document.activeElement.id,
        path: window.location.pathname,
        $timestamp: new Date().toISOString(),
      });
    }
  }, { passive: true });
}

function setupClipboardTracking(): void {
  document.addEventListener('copy', () => {
    posthog.capture('content_copied', {
      path: window.location.pathname,
      selectionLength: window.getSelection()?.toString().length || 0,
      $timestamp: new Date().toISOString(),
    });
  }, { passive: true });

  document.addEventListener('paste', (event) => {
    const target = event.target as HTMLElement;
    posthog.capture('content_pasted', {
      path: window.location.pathname,
      targetElement: target.tagName,
      targetId: target.id,
      $timestamp: new Date().toISOString(),
    });
  }, { passive: true });
}

function setupModalTracking(): void {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const dialog = node.matches('[role="dialog"], [data-state="open"]') 
            ? node 
            : node.querySelector('[role="dialog"], [data-state="open"]');
          
          if (dialog) {
            const dialogTitle = dialog.querySelector('[role="heading"], h1, h2, h3')?.textContent?.slice(0, 50);
            posthog.capture('dialog_opened', {
              dialogTitle,
              dialogId: dialog.id,
              path: window.location.pathname,
              $timestamp: new Date().toISOString(),
            });
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function setupSelectTracking(): void {
  document.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    
    if (target.matches('select')) {
      const select = target as HTMLSelectElement;
      posthog.capture('select_changed', {
        selectId: select.id,
        selectName: select.name,
        testId: select.getAttribute('data-testid'),
        selectedValue: select.value,
        selectedText: select.options[select.selectedIndex]?.text,
        path: window.location.pathname,
        $timestamp: new Date().toISOString(),
      });
    }

    if (target.matches('input[type="checkbox"]')) {
      const checkbox = target as HTMLInputElement;
      posthog.capture('checkbox_changed', {
        checkboxId: checkbox.id,
        checkboxName: checkbox.name,
        testId: checkbox.getAttribute('data-testid'),
        checked: checkbox.checked,
        path: window.location.pathname,
        $timestamp: new Date().toISOString(),
      });
    }

    if (target.matches('input[type="radio"]')) {
      const radio = target as HTMLInputElement;
      posthog.capture('radio_changed', {
        radioId: radio.id,
        radioName: radio.name,
        testId: radio.getAttribute('data-testid'),
        value: radio.value,
        path: window.location.pathname,
        $timestamp: new Date().toISOString(),
      });
    }
  }, { passive: true });
}

function setupTabTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const tabTrigger = target.closest('[role="tab"], [data-state]');
    
    if (tabTrigger) {
      const tabName = tabTrigger.textContent?.trim().slice(0, 50);
      const tabId = tabTrigger.id || tabTrigger.getAttribute('data-value');
      
      posthog.capture('tab_clicked', {
        tabName,
        tabId,
        path: window.location.pathname,
        $timestamp: new Date().toISOString(),
      });
    }
  }, { passive: true });
}

export function getPostHog() {
  return posthog;
}

export default posthog;
