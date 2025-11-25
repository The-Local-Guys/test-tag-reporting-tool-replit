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
  // Get user from session (where Express stores authenticated user)
  const session = (req as any).session;
  const user = session?.user;
  
  if (user?.id) return `user_${user.id}`;
  if (user?.email) return user.email;
  
  const sessionId = (req as any).sessionID || req.headers['x-session-id'];
  if (sessionId) return `session_${sessionId}`;
  
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  return `ip_${ip}`;
}

export function getAuthDetails(req: Request): Record<string, any> {
  // Get user from session (where Express stores authenticated user)
  const session = (req as any).session;
  const user = session?.user;
  
  return {
    // User identification
    user_id: user?.id || null,
    user_name: user?.username || null,
    user_email: user?.email || null,
    user_role: user?.role || null,
    user_full_name: user?.fullName || null,
    user_company: user?.companyName || null,
    // Authentication status
    is_authenticated: !!user,
    auth_method: user ? 'session' : 'anonymous',
    // Session info
    session_id: (req as any).sessionID || null,
  };
}

export function getRequestContext(req: Request): Record<string, any> {
  return {
    client_ip: req.ip || req.headers['x-forwarded-for'] || null,
    user_agent: req.headers['user-agent'] || null,
    referer: req.headers['referer'] || null,
    origin: req.headers['origin'] || null,
    host: req.headers['host'] || null,
    accept_language: req.headers['accept-language'] || null,
    content_type: req.headers['content-type'] || null,
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

function getActionDescription(method: string, path: string, routeCategory: string): string {
  const methodAction: Record<string, string> = {
    'GET': 'Viewed',
    'POST': 'Created',
    'PUT': 'Updated',
    'PATCH': 'Modified',
    'DELETE': 'Deleted',
  };
  
  const action = methodAction[method] || method;
  
  // Map route patterns to readable resource names
  if (path.includes('/certificates')) return `${action} Certificate`;
  if (path.includes('/test-sessions') && path.includes('/batch-results')) return `${action} Batch Results`;
  if (path.includes('/test-sessions') && path.includes('/results')) return `${action} Test Results`;
  if (path.includes('/test-sessions') && path.includes('/report')) return 'Generated Report';
  if (path.includes('/test-sessions')) return `${action} Test Session`;
  if (path.includes('/test-results')) return `${action} Test Result`;
  if (path.includes('/environments')) return `${action} Environment`;
  if (path.includes('/custom-forms')) return `${action} Custom Form`;
  if (path.includes('/users')) return `${action} User`;
  if (path.includes('/login')) return 'Login Attempt';
  if (path.includes('/logout')) return 'Logout Request';
  if (path.includes('/register')) return 'Registration Attempt';
  if (path.includes('/auth/user')) return 'Checked Auth Status';
  
  return `${action} ${routeCategory}`;
}

// Convert snake_case to Title Case for readable event names
function formatEventName(eventName: string): string {
  return eventName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function trackEvent(
  distinctId: string,
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!posthogClient) return;
  
  const readableEventName = formatEventName(eventName);
  
  posthogClient.capture({
    distinctId,
    event: readableEventName,
    properties: {
      ...properties,
      event_key: eventName,
      timestamp: new Date().toISOString(),
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

    // Generate human-readable action description
    const actionDescription = getActionDescription(req.method, path, routeCategory);

    const eventProperties: Record<string, any> = {
      // Action info (most important - at top)
      action: actionDescription,
      http_method: req.method,
      endpoint: req.path,
      // Response info
      status_code: res.statusCode,
      response_time_ms: duration,
      response_speed: duration < 100 ? 'fast' : duration < 500 ? 'normal' : duration < 1000 ? 'slow' : 'very_slow',
      // Category
      route_category: routeCategory,
      // Request details
      request_body: sanitizedBody,
      // User info (from authDetails)
      ...authDetails,
      // Timestamp
      timestamp: new Date().toISOString(),
    };

    posthogClient!.capture({
      distinctId,
      event: 'API Request',
      properties: eventProperties,
    });

    if (res.statusCode >= 400) {
      const errorType = res.statusCode === 401 ? 'Unauthorized' :
                        res.statusCode === 403 ? 'Forbidden' :
                        res.statusCode === 404 ? 'Not Found' :
                        res.statusCode >= 500 ? 'Server Error' : 'Client Error';
      
      posthogClient!.capture({
        distinctId,
        event: `API Error: ${errorType}`,
        properties: {
          ...eventProperties,
          error_type: errorType,
          error_message: responseBody?.message || responseBody?.error || null,
        },
      });
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (path.includes('/login') && req.method === 'POST') {
        trackAuthEvent(distinctId, 'User Logged In', authDetails, requestContext);
      } else if (path.includes('/logout')) {
        trackAuthEvent(distinctId, 'User Logged Out', authDetails, requestContext);
      } else if (path.includes('/register') && req.method === 'POST') {
        trackAuthEvent(distinctId, 'User Registered', authDetails, requestContext);
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
    login_success: success,
    error_message: errorMessage,
    attempted_username: req.body?.username || null,
  });

  if (success && authDetails.user_id) {
    identifyUser(distinctId, {
      ...authDetails,
      last_login_at: new Date().toISOString(),
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
    logout_reason: 'user_initiated',
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
    session_action: action,
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
    test_type: testType,
    test_result: result,
    is_passing: result === 'pass',
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
    session_id: sessionId,
    item_count: itemCount,
    pass_count: passCount,
    fail_count: failCount,
    pass_rate: itemCount > 0 ? (passCount / itemCount * 100).toFixed(2) : 0,
    service_type: serviceType,
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
    report_type: reportType,
    report_format: format,
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
    certificate_action: action,
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
    environment_action: action,
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
    form_action: action,
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
    management_action: action,
    performed_by: authDetails.user_name,
    performed_by_role: authDetails.user_role,
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
    admin_action: action,
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
    export_type: exportType,
    export_format: format,
    record_count: recordCount,
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
    event: 'Database Operation',
    properties: {
      db_operation: operation,
      db_table: table,
      duration_ms: duration,
      record_count: recordCount,
      duration_category: duration < 10 ? 'fast' : duration < 50 ? 'normal' : duration < 200 ? 'slow' : 'very_slow',
      timestamp: new Date().toISOString(),
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
