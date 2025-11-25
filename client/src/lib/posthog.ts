import posthog from 'posthog-js';

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

export function initPostHog(): void {
  if (isInitialized || typeof window === 'undefined') return;

  if (!POSTHOG_API_KEY) {
    console.log('[Analytics] Disabled - No API key');
    return;
  }

  try {
    posthog.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      persistence: 'localStorage',
    });

    isInitialized = true;
    console.log('[Analytics] Ready');
  } catch (error) {
    console.error('[Analytics] Failed to initialize');
  }
}

export function identifyUser(userId: number | string, username: string, role: string): void {
  if (!isInitialized) return;
  posthog.identify(`user_${userId}`, { username, role });
}

export function resetUser(): void {
  if (!isInitialized) return;
  posthog.reset();
}

function track(event: string, data?: Record<string, any>): void {
  if (!isInitialized) return;
  posthog.capture(event, data);
}

export function trackPageView(pageName: string): void {
  track('Page Viewed', { page: pageName });
}

export function trackUserLogin(username: string, role: string): void {
  track('User Logged In', { username, role });
}

export function trackUserLogout(): void {
  track('User Logged Out');
  resetUser();
}

export function trackJobStarted(data: {
  client: string;
  location: string;
  serviceType: string;
  country: string;
}): void {
  track('Job Started', {
    client: data.client,
    location: data.location,
    service: data.serviceType,
    country: data.country,
  });
}

export function trackItemSelected(data: {
  serviceType: string;
  itemName: string;
  classification?: string;
  frequency?: string;
}): void {
  track('Item Selected', {
    service: data.serviceType,
    item: data.itemName,
    classification: data.classification || 'N/A',
    frequency: data.frequency || 'N/A',
  });
}

export function trackTestRecorded(data: {
  serviceType: string;
  itemName: string;
  result: 'pass' | 'fail';
}): void {
  track('Test Recorded', {
    service: data.serviceType,
    item: data.itemName,
    result: data.result === 'pass' ? 'Pass' : 'Fail',
  });
}

export function trackJobCompleted(data: {
  client: string;
  serviceType: string;
  totalItems: number;
  passedItems: number;
  failedItems: number;
}): void {
  track('Job Completed', {
    client: data.client,
    service: data.serviceType,
    totalItems: data.totalItems,
    passed: data.passedItems,
    failed: data.failedItems,
    passRate: data.totalItems > 0 
      ? Math.round((data.passedItems / data.totalItems) * 100) + '%' 
      : '0%',
  });
}

export function trackReportPreviewed(data: {
  client: string;
  serviceType: string;
  itemCount: number;
}): void {
  track('Report Previewed', {
    client: data.client,
    service: data.serviceType,
    items: data.itemCount,
  });
}

export function trackReportDownloaded(data: {
  format: 'pdf' | 'excel';
  client: string;
  serviceType: string;
  itemCount: number;
}): void {
  track('Report Downloaded', {
    format: data.format.toUpperCase(),
    client: data.client,
    service: data.serviceType,
    items: data.itemCount,
  });
}

export function trackCertificateCreated(data: {
  clientName: string;
  services: string[];
}): void {
  track('Certificate Created', {
    client: data.clientName,
    services: data.services.join(', '),
    serviceCount: data.services.length,
  });
}

export function trackCertificateEdited(clientName: string): void {
  track('Certificate Edited', { client: clientName });
}

export function trackCertificateDownloaded(clientName: string): void {
  track('Certificate Downloaded', { client: clientName });
}

export function trackCertificateDeleted(clientName: string): void {
  track('Certificate Deleted', { client: clientName });
}

export function trackEnvironmentCreated(data: {
  name: string;
  serviceType: string;
  itemCount: number;
}): void {
  track('Custom Environment Created', {
    name: data.name,
    service: data.serviceType,
    items: data.itemCount,
  });
}

export function trackAdminAction(action: string, details?: Record<string, any>): void {
  track('Admin Action', {
    action,
    ...details,
  });
}

export function trackError(error: string, page?: string): void {
  track('Error Occurred', {
    error,
    page: page || window.location.pathname,
  });
}

export function getPostHog() {
  return posthog;
}

export default posthog;
