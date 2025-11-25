import { PostHog } from 'posthog-node';
import type { Request, Response, NextFunction } from 'express';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;

export function initPostHog(): PostHog | null {
  if (!POSTHOG_API_KEY) {
    console.warn('[PostHog] API key not configured. Analytics disabled.');
    return null;
  }

  posthogClient = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });

  console.log('[PostHog] Backend analytics initialized');
  return posthogClient;
}

export function getPostHogClient(): PostHog | null {
  return posthogClient;
}

export function getDistinctId(req: Request): string {
  const user = (req as any).user;
  if (user?.id) return `user_${user.id}`;
  if (user?.email) return user.email;
  
  const sessionId = (req as any).sessionID || req.headers['x-session-id'];
  if (sessionId) return `session_${sessionId}`;
  
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  return `ip_${ip}`;
}

export function getUserProperties(req: Request): Record<string, any> {
  const user = (req as any).user;
  return {
    userId: user?.id || null,
    username: user?.username || null,
    email: user?.email || null,
    role: user?.role || null,
    fullName: user?.fullName || null,
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

export function trackEvent(
  distinctId: string,
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!posthogClient) return;
  
  posthogClient.capture({
    distinctId,
    event: eventName,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
      source: 'backend',
    },
  });
}

export function identifyUser(
  distinctId: string,
  properties: Record<string, any>
): void {
  if (!posthogClient) return;
  
  posthogClient.identify({
    distinctId,
    properties,
  });
}

export function posthogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!posthogClient) {
    next();
    return;
  }

  const startTime = Date.now();
  const distinctId = getDistinctId(req);
  const userProps = getUserProperties(req);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const path = req.path;
    
    if (path.startsWith('/assets') || path.includes('.')) {
      return;
    }

    posthogClient!.capture({
      distinctId,
      event: 'api_request',
      properties: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        query: req.query,
        ...userProps,
        timestamp: new Date().toISOString(),
        source: 'backend',
      },
    });

    if (res.statusCode >= 400) {
      posthogClient!.capture({
        distinctId,
        event: 'api_error',
        properties: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          ...userProps,
          timestamp: new Date().toISOString(),
          source: 'backend',
        },
      });
    }
  });

  next();
}

export function trackLogin(req: Request, success: boolean, errorMessage?: string): void {
  const distinctId = getDistinctId(req);
  const userProps = getUserProperties(req);
  
  trackEvent(distinctId, success ? 'user_login_success' : 'user_login_failed', {
    ...userProps,
    success,
    errorMessage,
  });

  if (success && userProps.userId) {
    identifyUser(distinctId, userProps);
  }
}

export function trackLogout(req: Request): void {
  const distinctId = getDistinctId(req);
  const userProps = getUserProperties(req);
  
  trackEvent(distinctId, 'user_logout', userProps);
}

export function trackSessionAction(
  req: Request,
  action: string,
  sessionData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const userProps = getUserProperties(req);
  
  trackEvent(distinctId, `session_${action}`, {
    ...userProps,
    ...sessionData,
  });
}

export function trackTestResult(
  req: Request,
  testType: string,
  result: 'pass' | 'fail',
  testData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const userProps = getUserProperties(req);
  
  trackEvent(distinctId, 'test_result_recorded', {
    ...userProps,
    testType,
    result,
    ...testData,
  });
}

export function trackReportGenerated(
  req: Request,
  reportType: string,
  format: 'pdf' | 'excel',
  sessionData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const userProps = getUserProperties(req);
  
  trackEvent(distinctId, 'report_generated', {
    ...userProps,
    reportType,
    format,
    ...sessionData,
  });
}

export function trackCertificateAction(
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'downloaded',
  certificateData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const userProps = getUserProperties(req);
  
  trackEvent(distinctId, `certificate_${action}`, {
    ...userProps,
    ...certificateData,
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
      event: 'uncaught_exception',
      properties: {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        source: 'backend',
      },
    });
  }
});

process.on('unhandledRejection', (reason) => {
  if (posthogClient) {
    posthogClient.capture({
      distinctId: 'system',
      event: 'unhandled_rejection',
      properties: {
        reason: String(reason),
        timestamp: new Date().toISOString(),
        source: 'backend',
      },
    });
  }
});
