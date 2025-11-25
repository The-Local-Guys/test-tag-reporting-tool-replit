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
  
  // Prefix with "Frontend:" for clear source identification
  const prefixedEventName = eventName.startsWith('Frontend:') ? eventName : `Frontend: ${eventName}`;

  posthog.capture(prefixedEventName, {
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
    user_id: userId, 
    user_name: username, 
    user_role: role,
    login_method: 'password',
    login_time: new Date().toISOString(),
  };
  
  identifyUser(userId, loginProps);
  trackEvent('User Logged In', loginProps);
}

export function trackLogout(): void {
  const userInfo = getStoredUserInfo();
  trackEvent('User Logged Out', {
    ...userInfo,
    logout_time: new Date().toISOString(),
  });
  resetUser();
}

export function trackSessionStart(sessionData: Record<string, any>): void {
  trackEvent('Test Session Started', {
    ...sessionData,
    session_start_time: new Date().toISOString(),
  });
}

export function trackSessionComplete(sessionData: Record<string, any>): void {
  trackEvent('Test Session Completed', {
    ...sessionData,
    session_complete_time: new Date().toISOString(),
  });
}

export function trackSessionCancelled(sessionData: Record<string, any>): void {
  trackEvent('Test Session Cancelled', {
    ...sessionData,
    cancel_time: new Date().toISOString(),
  });
}

export function trackTestResult(
  testType: string,
  result: 'pass' | 'fail',
  itemData?: Record<string, any>
): void {
  trackEvent(result === 'pass' ? 'Test Passed' : 'Test Failed', {
    test_type: testType,
    test_result: result,
    is_passing: result === 'pass',
    recorded_at: new Date().toISOString(),
    ...itemData,
  });
}

export function trackItemAdded(serviceType: string, itemData: Record<string, any>): void {
  trackEvent('Test Item Added', {
    service_type: serviceType,
    ...itemData,
    added_at: new Date().toISOString(),
  });
}

export function trackItemDeleted(serviceType: string, itemData: Record<string, any>): void {
  trackEvent('Test Item Deleted', {
    service_type: serviceType,
    ...itemData,
    deleted_at: new Date().toISOString(),
  });
}

export function trackReportPreview(sessionData: Record<string, any>): void {
  trackEvent('Report Previewed', {
    ...sessionData,
    preview_time: new Date().toISOString(),
  });
}

export function trackReportDownload(format: 'pdf' | 'excel', sessionData: Record<string, any>): void {
  trackEvent(`Report Downloaded (${format.toUpperCase()})`, {
    report_format: format,
    ...sessionData,
    download_time: new Date().toISOString(),
  });
}

export function trackCertificateAction(
  action: 'created' | 'updated' | 'deleted' | 'downloaded' | 'previewed' | 'modal_opened' | 'modal_closed',
  certificateData?: Record<string, any>
): void {
  const actionMap: Record<string, string> = {
    created: 'Certificate Created',
    updated: 'Certificate Updated',
    deleted: 'Certificate Deleted',
    downloaded: 'Certificate Downloaded',
    previewed: 'Certificate Previewed',
    modal_opened: 'Certificate Modal Opened',
    modal_closed: 'Certificate Modal Closed',
  };
  trackEvent(actionMap[action] || `Certificate ${action}`, {
    ...certificateData,
    action_time: new Date().toISOString(),
  });
}

export function trackEnvironmentAction(
  action: 'selected' | 'created' | 'updated' | 'deleted',
  environmentData?: Record<string, any>
): void {
  const actionMap: Record<string, string> = {
    selected: 'Environment Selected',
    created: 'Environment Created',
    updated: 'Environment Updated',
    deleted: 'Environment Deleted',
  };
  trackEvent(actionMap[action] || `Environment ${action}`, {
    ...environmentData,
    action_time: new Date().toISOString(),
  });
}

export function trackNavigation(from: string, to: string, method: 'click' | 'programmatic' = 'click'): void {
  trackEvent('Page Navigation', { 
    from_page: from, 
    to_page: to, 
    navigation_method: method,
    navigation_time: new Date().toISOString(),
  });
}

export function trackButtonClick(buttonName: string, context?: Record<string, any>): void {
  trackEvent(`Button Click: ${buttonName}`, { 
    button_name: buttonName, 
    ...context,
    click_time: new Date().toISOString(),
  });
}

export function trackFormSubmit(formName: string, success: boolean, data?: Record<string, any>): void {
  trackEvent(success ? `Form Submitted: ${formName}` : `Form Submit Failed: ${formName}`, { 
    form_name: formName, 
    submit_success: success, 
    ...data,
    submit_time: new Date().toISOString(),
  });
}

export function trackFormValidationError(formName: string, fieldErrors: Record<string, string>): void {
  trackEvent(`Form Validation Error: ${formName}`, {
    form_name: formName,
    field_errors: fieldErrors,
    error_count: Object.keys(fieldErrors).length,
    error_time: new Date().toISOString(),
  });
}

export function trackModalOpen(modalName: string, context?: Record<string, any>): void {
  trackEvent(`Modal Opened: ${modalName}`, {
    modal_name: modalName,
    ...context,
    open_time: new Date().toISOString(),
  });
}

export function trackModalClose(modalName: string, closeReason: 'submit' | 'cancel' | 'backdrop' | 'escape' = 'cancel'): void {
  trackEvent(`Modal Closed: ${modalName}`, {
    modal_name: modalName,
    close_reason: closeReason,
    close_time: new Date().toISOString(),
  });
}

export function trackTabChange(tabName: string, previousTab?: string): void {
  trackEvent(`Tab Changed: ${tabName}`, {
    tab_name: tabName,
    previous_tab: previousTab,
    change_time: new Date().toISOString(),
  });
}

export function trackDropdownSelect(dropdownName: string, selectedValue: string, previousValue?: string): void {
  trackEvent(`Dropdown Selected: ${dropdownName}`, {
    dropdown_name: dropdownName,
    selected_value: selectedValue,
    previous_value: previousValue,
    select_time: new Date().toISOString(),
  });
}

export function trackCheckboxToggle(checkboxName: string, checked: boolean): void {
  trackEvent(checked ? `Checkbox Checked: ${checkboxName}` : `Checkbox Unchecked: ${checkboxName}`, {
    checkbox_name: checkboxName,
    is_checked: checked,
    toggle_time: new Date().toISOString(),
  });
}

export function trackSearchPerformed(searchQuery: string, resultCount?: number, context?: string): void {
  trackEvent('Search Performed', {
    search_query: searchQuery.substring(0, 100),
    result_count: resultCount,
    search_context: context,
    search_time: new Date().toISOString(),
  });
}

export function trackFileUpload(fileName: string, fileSize: number, fileType: string, success: boolean): void {
  trackEvent(success ? 'File Uploaded' : 'File Upload Failed', {
    file_name: fileName,
    file_size: fileSize,
    file_type: fileType,
    upload_success: success,
    upload_time: new Date().toISOString(),
  });
}

export function trackError(error: Error | string, context?: Record<string, any>): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  trackEvent('Frontend Error', {
    error_message: errorMessage,
    error_stack: errorStack,
    ...context,
    error_time: new Date().toISOString(),
  });
}

export function trackAPICall(
  endpoint: string,
  method: string,
  success: boolean,
  duration: number,
  statusCode?: number
): void {
  trackEvent(success ? 'API Call Success' : 'API Call Failed', {
    api_endpoint: endpoint,
    http_method: method,
    call_success: success,
    duration_ms: duration,
    status_code: statusCode,
    call_time: new Date().toISOString(),
  });
}

export function trackServiceTypeSelected(serviceType: string): void {
  trackEvent(`Service Selected: ${serviceType}`, {
    service_type: serviceType,
    select_time: new Date().toISOString(),
  });
}

export function trackCountrySelected(country: string, serviceType?: string): void {
  trackEvent(`Country Selected: ${country}`, {
    country,
    service_type: serviceType,
    select_time: new Date().toISOString(),
  });
}

export function trackFrequencySelected(frequency: string, serviceType?: string): void {
  trackEvent(`Frequency Selected: ${frequency}`, {
    frequency,
    service_type: serviceType,
    select_time: new Date().toISOString(),
  });
}

export function trackClassificationSelected(classification: string): void {
  trackEvent(`Classification Selected: ${classification}`, {
    classification,
    select_time: new Date().toISOString(),
  });
}

export function trackAssetNumberChanged(assetNumber: string, method: 'auto' | 'manual'): void {
  trackEvent('Asset Number Changed', {
    asset_number: assetNumber,
    change_method: method,
    change_time: new Date().toISOString(),
  });
}

export function trackPhotoCapture(success: boolean, context?: string): void {
  trackEvent(success ? 'Photo Captured' : 'Photo Capture Failed', {
    capture_success: success,
    capture_context: context,
    capture_time: new Date().toISOString(),
  });
}

function setupErrorTracking(): void {
  window.addEventListener('error', (event) => {
    const userInfo = getStoredUserInfo();
    posthog.capture('Frontend: JavaScript Error', {
      error_message: event.message,
      error_file: event.filename,
      error_line: event.lineno,
      error_column: event.colno,
      error_stack: event.error?.stack,
      error_type: 'runtime',
      page_path: window.location.pathname,
      source: 'frontend',
      ...userInfo,
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const userInfo = getStoredUserInfo();
    posthog.capture('Frontend: Promise Rejection', {
      error_reason: String(event.reason),
      error_type: 'unhandled_promise',
      page_path: window.location.pathname,
      source: 'frontend',
      ...userInfo,
      timestamp: new Date().toISOString(),
    });
  });
}

function getButtonAction(element: HTMLElement): string {
  // Check aria-label first (most reliable for icon buttons)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  // Check data-testid for action clues (e.g., "button-delete", "delete-session")
  const testId = element.getAttribute('data-testid');
  if (testId) {
    const actionMatch = testId.match(/(?:button-|btn-)?(\w+)(?:-button|-btn)?/i);
    if (actionMatch) {
      return actionMatch[1].charAt(0).toUpperCase() + actionMatch[1].slice(1);
    }
  }
  
  // Check for common action class names
  const className = element.className || '';
  if (className.includes('delete') || className.includes('trash')) return 'Delete';
  if (className.includes('edit') || className.includes('pencil')) return 'Edit';
  if (className.includes('save') || className.includes('check')) return 'Save';
  if (className.includes('close') || className.includes('x-')) return 'Close';
  if (className.includes('add') || className.includes('plus')) return 'Add';
  if (className.includes('cancel')) return 'Cancel';
  if (className.includes('submit')) return 'Submit';
  if (className.includes('view') || className.includes('eye')) return 'View';
  if (className.includes('download')) return 'Download';
  if (className.includes('upload')) return 'Upload';
  
  // Check button text content
  const text = element.innerText?.trim().slice(0, 30);
  if (text) return text;
  
  // Check for SVG icon child with known names
  const svg = element.querySelector('svg');
  if (svg) {
    const svgClass = svg.getAttribute('class') || '';
    if (svgClass.includes('trash') || svgClass.includes('delete')) return 'Delete';
    if (svgClass.includes('edit') || svgClass.includes('pencil')) return 'Edit';
    if (svgClass.includes('x') || svgClass.includes('close')) return 'Close';
    if (svgClass.includes('plus') || svgClass.includes('add')) return 'Add';
    if (svgClass.includes('check') || svgClass.includes('save')) return 'Save';
    if (svgClass.includes('eye') || svgClass.includes('view')) return 'View';
    if (svgClass.includes('download')) return 'Download';
    
    // Check for lucide icon data attribute
    const lucideIcon = svg.querySelector('[data-lucide]');
    if (lucideIcon) {
      const iconName = lucideIcon.getAttribute('data-lucide');
      if (iconName) return iconName.charAt(0).toUpperCase() + iconName.slice(1);
    }
  }
  
  // Check title attribute
  const title = element.getAttribute('title');
  if (title) return title;
  
  return 'Unknown Action';
}

function setupClickTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    // Find the closest interactive element
    const closestButton = target.closest('button, a, [role="button"], input[type="submit"], [data-testid]');
    if (!closestButton) return;
    
    const element = closestButton as HTMLElement;
    const buttonAction = getButtonAction(element);
    const isIconButton = !element.innerText?.trim() && element.querySelector('svg');

    const elementInfo = {
      // Most important - what action was performed
      button_action: buttonAction,
      is_icon_button: isIconButton,
      // Element details
      element_type: element.tagName.toLowerCase(),
      element_id: element.id || undefined,
      element_text: element.innerText?.trim().slice(0, 50) || undefined,
      test_id: element.getAttribute('data-testid') || undefined,
      href: (element as HTMLAnchorElement).href || undefined,
      aria_label: element.getAttribute('aria-label') || undefined,
      is_disabled: (element as HTMLButtonElement).disabled || undefined,
      // Page context
      page_path: window.location.pathname,
    };

    const userInfo = getStoredUserInfo();

    posthog.capture(`Frontend: Button Click: ${buttonAction}`, {
      ...elementInfo,
      ...userInfo,
      source: 'frontend',
      timestamp: new Date().toISOString(),
    });
  }, { passive: true });
}

function setupFormTracking(): void {
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (!form) return;

    const userInfo = getStoredUserInfo();
    const formName = form.name || form.id || 'Unknown Form';
    const formInfo = {
      form_id: form.id || undefined,
      form_name: form.name || undefined,
      form_action: form.action || undefined,
      form_method: form.method || undefined,
      input_count: form.querySelectorAll('input, select, textarea').length,
      page_path: window.location.pathname,
    };

    posthog.capture(`Frontend: Form Submitted: ${formName}`, {
      ...formInfo,
      ...userInfo,
      source: 'frontend',
      timestamp: new Date().toISOString(),
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
    const inputName = (target as HTMLInputElement).name || target.id || inputType;
    const userInfo = getStoredUserInfo();

    posthog.capture(`Frontend: Input Focused: ${inputName}`, {
      input_type: inputType,
      input_id: target.id || undefined,
      input_name: (target as HTMLInputElement).name || undefined,
      test_id: target.getAttribute('data-testid') || undefined,
      page_path: window.location.pathname,
      source: 'frontend',
      ...userInfo,
      timestamp: new Date().toISOString(),
    });
  }, { passive: true });

  document.addEventListener('focusout', (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches('input, textarea, select')) return;
    if (target !== lastFocusedElement) return;

    const focusDuration = focusStartTime ? Date.now() - focusStartTime : 0;
    const inputType = (target as HTMLInputElement).type || target.tagName.toLowerCase();
    const inputName = (target as HTMLInputElement).name || target.id || inputType;
    const hasValue = !!(target as HTMLInputElement).value;
    const userInfo = getStoredUserInfo();

    posthog.capture(`Frontend: Input Completed: ${inputName}`, {
      input_type: inputType,
      input_id: target.id || undefined,
      input_name: (target as HTMLInputElement).name || undefined,
      test_id: target.getAttribute('data-testid') || undefined,
      focus_duration_ms: focusDuration,
      has_value: hasValue,
      page_path: window.location.pathname,
      source: 'frontend',
      ...userInfo,
      timestamp: new Date().toISOString(),
    });

    focusStartTime = null;
    lastFocusedElement = null;
  }, { passive: true });
}

function setupScrollTracking(): void {
  let scrollTimeout: ReturnType<typeof setTimeout>;
  let maxScrollDepth = 0;
  let lastScrollTime = Date.now();
  let trackedDepths = new Set<number>();

  window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
    
    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;
    }

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const userInfo = getStoredUserInfo();
      const scrollDuration = Date.now() - lastScrollTime;
      
      const depthMilestone = maxScrollDepth >= 100 ? 100 : 
                             maxScrollDepth >= 75 ? 75 :
                             maxScrollDepth >= 50 ? 50 :
                             maxScrollDepth >= 25 ? 25 : 0;
      
      if (depthMilestone > 0 && !trackedDepths.has(depthMilestone)) {
        trackedDepths.add(depthMilestone);
        posthog.capture(`Frontend: Scrolled ${depthMilestone}%`, { 
          scroll_depth_percent: depthMilestone,
          scroll_duration_ms: scrollDuration,
          page_path: window.location.pathname,
          source: 'frontend',
          ...userInfo,
          timestamp: new Date().toISOString(),
        });
      }
      
      lastScrollTime = Date.now();
    }, 500);
  }, { passive: true });
}

function setupVisibilityTracking(): void {
  let hiddenTime: number | null = null;

  document.addEventListener('visibilitychange', () => {
    const userInfo = getStoredUserInfo();
    
    if (document.hidden) {
      hiddenTime = Date.now();
      posthog.capture('Frontend: Page Hidden', {
        page_path: window.location.pathname,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
    } else {
      const hiddenDuration = hiddenTime ? Date.now() - hiddenTime : 0;
      posthog.capture('Frontend: Page Returned', {
        page_path: window.location.pathname,
        hidden_duration_ms: hiddenDuration,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
      hiddenTime = null;
    }
  });

  window.addEventListener('beforeunload', () => {
    const userInfo = getStoredUserInfo();
    posthog.capture('Frontend: Page Leaving', {
      page_path: window.location.pathname,
      source: 'frontend',
      ...userInfo,
      timestamp: new Date().toISOString(),
    });
  });
}

function setupKeyboardTracking(): void {
  document.addEventListener('keydown', (event) => {
    const userInfo = getStoredUserInfo();
    
    if (event.key === 'Escape') {
      posthog.capture('Frontend: Pressed Escape', {
        page_path: window.location.pathname,
        active_element: document.activeElement?.tagName,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      posthog.capture('Frontend: Keyboard Save', {
        page_path: window.location.pathname,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
    }

    if (event.key === 'Enter' && document.activeElement?.matches('input, textarea')) {
      posthog.capture('Frontend: Pressed Enter', {
        input_type: (document.activeElement as HTMLInputElement).type,
        input_id: document.activeElement.id,
        page_path: window.location.pathname,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
    }
  }, { passive: true });
}

function setupClipboardTracking(): void {
  document.addEventListener('copy', () => {
    const userInfo = getStoredUserInfo();
    posthog.capture('Frontend: Content Copied', {
      page_path: window.location.pathname,
      selection_length: window.getSelection()?.toString().length || 0,
      source: 'frontend',
      ...userInfo,
      timestamp: new Date().toISOString(),
    });
  }, { passive: true });

  document.addEventListener('paste', (event) => {
    const target = event.target as HTMLElement;
    const userInfo = getStoredUserInfo();
    posthog.capture('Frontend: Content Pasted', {
      page_path: window.location.pathname,
      target_element: target.tagName,
      target_id: target.id,
      source: 'frontend',
      ...userInfo,
      timestamp: new Date().toISOString(),
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
            const userInfo = getStoredUserInfo();
            posthog.capture(`Frontend: Dialog Opened: ${dialogTitle || 'Unnamed'}`, {
              dialog_title: dialogTitle || 'Unnamed Dialog',
              dialog_id: dialog.id,
              page_path: window.location.pathname,
              source: 'frontend',
              ...userInfo,
              timestamp: new Date().toISOString(),
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
    const userInfo = getStoredUserInfo();
    
    if (target.matches('select')) {
      const select = target as HTMLSelectElement;
      const selectName = select.name || select.id || 'Unknown';
      posthog.capture(`Frontend: Dropdown Selected: ${selectName}`, {
        select_id: select.id,
        select_name: select.name,
        test_id: select.getAttribute('data-testid'),
        selected_value: select.value,
        selected_text: select.options[select.selectedIndex]?.text,
        page_path: window.location.pathname,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
    }

    if (target.matches('input[type="checkbox"]')) {
      const checkbox = target as HTMLInputElement;
      const checkboxName = checkbox.name || checkbox.id || 'Unknown';
      posthog.capture(checkbox.checked ? `Frontend: Checkbox Checked: ${checkboxName}` : `Frontend: Checkbox Unchecked: ${checkboxName}`, {
        checkbox_id: checkbox.id,
        checkbox_name: checkbox.name,
        test_id: checkbox.getAttribute('data-testid'),
        is_checked: checkbox.checked,
        page_path: window.location.pathname,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
    }

    if (target.matches('input[type="radio"]')) {
      const radio = target as HTMLInputElement;
      const radioName = radio.name || radio.id || 'Unknown';
      posthog.capture(`Frontend: Radio Selected: ${radioName}`, {
        radio_id: radio.id,
        radio_name: radio.name,
        test_id: radio.getAttribute('data-testid'),
        value: radio.value,
        page_path: window.location.pathname,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
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
      const userInfo = getStoredUserInfo();
      
      posthog.capture(`Frontend: Tab Selected: ${tabName || 'Unknown'}`, {
        tab_name: tabName,
        tab_id: tabId,
        page_path: window.location.pathname,
        source: 'frontend',
        ...userInfo,
        timestamp: new Date().toISOString(),
      });
    }
  }, { passive: true });
}

export function getPostHog() {
  return posthog;
}

export default posthog;
