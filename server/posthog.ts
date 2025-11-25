import { PostHog } from 'posthog-node';
import type { Request, Response, NextFunction } from 'express';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;

export function initPostHog(): PostHog | null {
  if (!POSTHOG_API_KEY) {
    console.log('[Analytics] Disabled - No API key configured');
    return null;
  }

  posthogClient = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });

  console.log('[Analytics] Ready');
  return posthogClient;
}

export function getPostHogClient(): PostHog | null {
  return posthogClient;
}

function getUserId(req: Request): string {
  const user = (req as any).user;
  if (user?.id) return `user_${user.id}`;
  return 'anonymous';
}

function getUserInfo(req: Request): { user: string; role: string } {
  const user = (req as any).user;
  return {
    user: user?.username || 'anonymous',
    role: user?.role || 'guest',
  };
}

export function track(req: Request, event: string, data?: Record<string, any>): void {
  if (!posthogClient) return;

  const userInfo = getUserInfo(req);
  
  posthogClient.capture({
    distinctId: getUserId(req),
    event,
    properties: {
      ...userInfo,
      ...data,
    },
  });
}

export function trackUserLogin(req: Request, username: string, role: string): void {
  if (!posthogClient) return;

  const userId = getUserId(req);
  
  posthogClient.identify({
    distinctId: userId,
    properties: { username, role },
  });

  posthogClient.capture({
    distinctId: userId,
    event: 'User Logged In',
    properties: { username, role },
  });
}

export function trackUserLogout(req: Request): void {
  track(req, 'User Logged Out');
}

export function trackJobStarted(req: Request, data: {
  client: string;
  location: string;
  serviceType: string;
  country: string;
}): void {
  track(req, 'Job Started', {
    client: data.client,
    location: data.location,
    service: data.serviceType,
    country: data.country,
  });
}

export function trackJobCompleted(req: Request, data: {
  sessionId: number;
  client: string;
  serviceType: string;
  totalItems: number;
  passedItems: number;
  failedItems: number;
}): void {
  track(req, 'Job Completed', {
    jobId: data.sessionId,
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

export function trackTestRecorded(req: Request, data: {
  serviceType: string;
  itemName: string;
  result: 'pass' | 'fail';
  classification?: string;
}): void {
  track(req, 'Test Recorded', {
    service: data.serviceType,
    item: data.itemName,
    result: data.result === 'pass' ? 'Pass' : 'Fail',
    classification: data.classification || 'N/A',
  });
}

export function trackReportDownloaded(req: Request, data: {
  format: 'pdf' | 'excel';
  client: string;
  serviceType: string;
  itemCount: number;
}): void {
  track(req, 'Report Downloaded', {
    format: data.format.toUpperCase(),
    client: data.client,
    service: data.serviceType,
    items: data.itemCount,
  });
}

export function trackCertificateCreated(req: Request, data: {
  clientName: string;
  services: string[];
}): void {
  track(req, 'Certificate Created', {
    client: data.clientName,
    services: data.services.join(', '),
    serviceCount: data.services.length,
  });
}

export function trackCertificateDownloaded(req: Request, clientName: string): void {
  track(req, 'Certificate Downloaded', { client: clientName });
}

export function trackUserCreated(req: Request, data: {
  newUsername: string;
  newRole: string;
}): void {
  track(req, 'User Created', {
    newUser: data.newUsername,
    assignedRole: data.newRole,
  });
}

export function trackEnvironmentCreated(req: Request, data: {
  name: string;
  serviceType: string;
  itemCount: number;
}): void {
  track(req, 'Custom Environment Created', {
    name: data.name,
    service: data.serviceType,
    items: data.itemCount,
  });
}

export function trackError(req: Request, error: string, context?: string): void {
  track(req, 'Error Occurred', {
    error,
    context: context || 'Unknown',
  });
}

export function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    return posthogClient.shutdown();
  }
  return Promise.resolve();
}

process.on('uncaughtException', (error) => {
  if (posthogClient) {
    posthogClient.capture({
      distinctId: 'system',
      event: 'Server Error',
      properties: {
        type: 'Uncaught Exception',
        error: error.message,
      },
    });
  }
});

process.on('unhandledRejection', (reason) => {
  if (posthogClient) {
    posthogClient.capture({
      distinctId: 'system',
      event: 'Server Error',
      properties: {
        type: 'Unhandled Promise Rejection',
        error: String(reason),
      },
    });
  }
});
