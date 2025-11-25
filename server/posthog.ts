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

export function getAuthDetails(req: Request): Record<string, any> {
  const user = (req as any).user;
  const session = (req as any).session;
  
  return {
    isAuthenticated: !!user,
    authMethod: user ? 'session' : 'anonymous',
    userId: user?.id || null,
    username: user?.username || null,
    email: user?.email || null,
    role: user?.role || null,
    fullName: user?.fullName || null,
    companyName: user?.companyName || null,
    sessionId: (req as any).sessionID || null,
    sessionCreatedAt: session?.cookie?.expires ? new Date(session.cookie.expires).toISOString() : null,
    sessionMaxAge: session?.cookie?.maxAge || null,
  };
}

export function getRequestContext(req: Request): Record<string, any> {
  return {
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
    referer: req.headers['referer'] || null,
    origin: req.headers['origin'] || null,
    host: req.headers['host'] || null,
    acceptLanguage: req.headers['accept-language'] || null,
    contentType: req.headers['content-type'] || null,
    contentLength: req.headers['content-length'] || null,
  };
}

function sanitizeRequestBody(body: any, path: string): Record<string, any> | null {
  if (!body || typeof body !== 'object') return null;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.substring(0, 200) + '...[truncated]';
    } else if (key === 'photoData' || key === 'csvData') {
      sanitized[key] = value ? '[DATA_PRESENT]' : null;
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function getRouteCategory(path: string, method: string): string {
  if (path.includes('/auth') || path.includes('/login') || path.includes('/logout') || path.includes('/register')) {
    return 'authentication';
  }
  if (path.includes('/certificates')) return 'certificates';
  if (path.includes('/test-sessions') || path.includes('/test-results')) return 'testing';
  if (path.includes('/environments')) return 'environments';
  if (path.includes('/custom-form-types')) return 'custom_forms';
  if (path.includes('/users')) return 'user_management';
  if (path.includes('/admin')) return 'admin';
  return 'general';
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
      $timestamp: new Date().toISOString(),
      source: 'backend',
      environment: process.env.NODE_ENV || 'development',
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
    properties: {
      ...properties,
      $set_once: {
        first_seen: new Date().toISOString(),
      },
    },
  });
}

export function posthogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!posthogClient) {
    next();
    return;
  }

  const startTime = Date.now();
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  const requestContext = getRequestContext(req);
  const routeCategory = getRouteCategory(req.path, req.method);

  const originalJson = res.json.bind(res);
  let responseBody: any = null;
  
  res.json = function(body: any) {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const path = req.path;
    
    if (path.startsWith('/assets') || path.includes('.') || path === '/favicon.ico') {
      return;
    }

    const sanitizedBody = ['POST', 'PUT', 'PATCH'].includes(req.method) 
      ? sanitizeRequestBody(req.body, path) 
      : null;

    const eventProperties: Record<string, any> = {
      method: req.method,
      path: req.path,
      fullUrl: req.originalUrl,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration,
      durationCategory: duration < 100 ? 'fast' : duration < 500 ? 'normal' : duration < 1000 ? 'slow' : 'very_slow',
      routeCategory,
      queryParams: Object.keys(req.query).length > 0 ? req.query : null,
      requestBody: sanitizedBody,
      ...authDetails,
      ...requestContext,
    };

    posthogClient!.capture({
      distinctId,
      event: 'api_request',
      properties: eventProperties,
    });

    if (res.statusCode >= 400) {
      const errorEventName = res.statusCode === 401 ? 'api_unauthorized' :
                             res.statusCode === 403 ? 'api_forbidden' :
                             res.statusCode === 404 ? 'api_not_found' :
                             res.statusCode >= 500 ? 'api_server_error' : 'api_client_error';
      
      posthogClient!.capture({
        distinctId,
        event: errorEventName,
        properties: {
          ...eventProperties,
          errorType: errorEventName,
          responseBody: responseBody?.message || responseBody?.error || null,
        },
      });
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (path.includes('/login') && req.method === 'POST') {
        trackAuthEvent(distinctId, 'login_success', authDetails, requestContext);
      } else if (path.includes('/logout')) {
        trackAuthEvent(distinctId, 'logout_success', authDetails, requestContext);
      } else if (path.includes('/register') && req.method === 'POST') {
        trackAuthEvent(distinctId, 'registration_success', authDetails, requestContext);
      }
    }
  });

  next();
}

function trackAuthEvent(
  distinctId: string,
  eventType: string,
  authDetails: Record<string, any>,
  requestContext: Record<string, any>
): void {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId,
    event: eventType,
    properties: {
      ...authDetails,
      ...requestContext,
      $timestamp: new Date().toISOString(),
      source: 'backend',
    },
  });
}

export function trackLogin(req: Request, success: boolean, errorMessage?: string): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  const requestContext = getRequestContext(req);
  
  trackEvent(distinctId, success ? 'user_login_success' : 'user_login_failed', {
    ...authDetails,
    ...requestContext,
    success,
    errorMessage,
    attemptedUsername: req.body?.username || null,
  });

  if (success && authDetails.userId) {
    identifyUser(distinctId, {
      ...authDetails,
      lastLoginAt: new Date().toISOString(),
      loginCount: { $increment: 1 },
    });
  }
}

export function trackLogout(req: Request): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  const requestContext = getRequestContext(req);
  
  trackEvent(distinctId, 'user_logout', {
    ...authDetails,
    ...requestContext,
    logoutReason: 'user_initiated',
  });
}

export function trackSessionAction(
  req: Request,
  action: 'created' | 'updated' | 'completed' | 'cancelled' | 'resumed',
  sessionData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  const requestContext = getRequestContext(req);
  
  trackEvent(distinctId, `test_session_${action}`, {
    ...authDetails,
    ...requestContext,
    sessionAction: action,
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
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, 'test_result_recorded', {
    ...authDetails,
    testType,
    result,
    isPassing: result === 'pass',
    ...testData,
  });
}

export function trackBatchSubmission(
  req: Request,
  sessionId: number,
  itemCount: number,
  passCount: number,
  failCount: number,
  serviceType?: string
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, 'batch_results_submitted', {
    ...authDetails,
    sessionId,
    itemCount,
    passCount,
    failCount,
    passRate: itemCount > 0 ? (passCount / itemCount * 100).toFixed(2) : 0,
    serviceType,
  });
}

export function trackReportGenerated(
  req: Request,
  reportType: string,
  format: 'pdf' | 'excel',
  sessionData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, 'report_generated', {
    ...authDetails,
    reportType,
    format,
    ...sessionData,
  });
}

export function trackCertificateAction(
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'downloaded' | 'previewed',
  certificateData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, `certificate_${action}`, {
    ...authDetails,
    certificateAction: action,
    ...certificateData,
  });
}

export function trackEnvironmentAction(
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'selected',
  environmentData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, `environment_${action}`, {
    ...authDetails,
    environmentAction: action,
    ...environmentData,
  });
}

export function trackCustomFormAction(
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'uploaded',
  formData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, `custom_form_${action}`, {
    ...authDetails,
    formAction: action,
    ...formData,
  });
}

export function trackUserManagementAction(
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'role_changed' | 'password_reset',
  targetUserData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, `user_management_${action}`, {
    ...authDetails,
    managementAction: action,
    performedBy: authDetails.username,
    performedByRole: authDetails.role,
    ...targetUserData,
  });
}

export function trackAdminAction(
  req: Request,
  action: string,
  actionData?: Record<string, any>
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, `admin_${action}`, {
    ...authDetails,
    adminAction: action,
    ...actionData,
  });
}

export function trackDataExport(
  req: Request,
  exportType: 'sessions' | 'results' | 'users' | 'certificates',
  format: 'pdf' | 'excel' | 'csv',
  recordCount: number
): void {
  const distinctId = getDistinctId(req);
  const authDetails = getAuthDetails(req);
  
  trackEvent(distinctId, 'data_exported', {
    ...authDetails,
    exportType,
    format,
    recordCount,
  });
}

export function trackDatabaseOperation(
  operation: 'query' | 'insert' | 'update' | 'delete',
  table: string,
  duration: number,
  recordCount?: number,
  userId?: number
): void {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: userId ? `user_${userId}` : 'system',
    event: 'database_operation',
    properties: {
      operation,
      table,
      duration,
      recordCount,
      durationCategory: duration < 10 ? 'fast' : duration < 50 ? 'normal' : duration < 200 ? 'slow' : 'very_slow',
      $timestamp: new Date().toISOString(),
      source: 'backend',
    },
  });
}

export function trackSystemEvent(
  eventType: 'startup' | 'shutdown' | 'health_check' | 'maintenance',
  eventData?: Record<string, any>
): void {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: 'system',
    event: `system_${eventType}`,
    properties: {
      ...eventData,
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      $timestamp: new Date().toISOString(),
      source: 'backend',
      environment: process.env.NODE_ENV || 'development',
    },
  });
}

export function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    trackSystemEvent('shutdown', { reason: 'process_exit' });
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
        errorName: error.name,
        stack: error.stack,
        $timestamp: new Date().toISOString(),
        source: 'backend',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
      },
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  if (posthogClient) {
    posthogClient.capture({
      distinctId: 'system',
      event: 'unhandled_rejection',
      properties: {
        reason: String(reason),
        reasonType: typeof reason,
        $timestamp: new Date().toISOString(),
        source: 'backend',
        environment: process.env.NODE_ENV || 'development',
      },
    });
  }
});

process.on('warning', (warning) => {
  if (posthogClient) {
    posthogClient.capture({
      distinctId: 'system',
      event: 'process_warning',
      properties: {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
        $timestamp: new Date().toISOString(),
        source: 'backend',
      },
    });
  }
});
