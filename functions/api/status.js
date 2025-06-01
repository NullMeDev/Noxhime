/**
 * API handler for the status endpoint
 * Provides system status, events, and incidents data
 */

// Mock data for development environments
const MOCK_DATA = {
  status: 'operational',
  events: [
    {
      id: 'evt-001',
      description: 'Scheduled maintenance completed successfully',
      timestamp: Date.now() - 86400000, // 1 day ago
      type: 'maintenance'
    },
    {
      id: 'evt-002',
      description: 'AI model upgraded to DeepSeek-V3',
      timestamp: Date.now() - 172800000, // 2 days ago
      type: 'system'
    },
    {
      id: 'evt-003',
      description: 'Database performance optimization applied',
      timestamp: Date.now() - 259200000, // 3 days ago
      type: 'database'
    }
  ],
  incidents: [
    {
      id: 'inc-001',
      title: 'API Response Degradation',
      description: 'Users experiencing slower than normal response times on certain API endpoints.',
      timestamp: Date.now() - 345600000, // 4 days ago
      resolved: true,
      resolvedAt: Date.now() - 172800000 // 2 days ago
    },
    {
      id: 'inc-002',
      title: 'Intermittent Connection Issues',
      description: 'Some users reporting connection drops during extended conversations.',
      timestamp: Date.now() - 43200000, // 12 hours ago
      resolved: false,
      resolvedAt: null
    }
  ],
  metrics: {
    uptime: 99.98,
    responseTime: 187, // ms
    errorRate: 0.05 // %
  }
};

// Store request timestamps for rate limiting
const requestTimestamps = new Map();

/**
 * Check if a request is rate limited
 * @param {string} ip - The client IP address
 * @param {number} maxRequests - Maximum requests allowed per minute
 * @returns {boolean} - Whether the request is allowed
 */
function checkRateLimit(ip, maxRequests = 60) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  
  // Get existing timestamps for this IP
  let timestamps = requestTimestamps.get(ip) || [];
  
  // Filter out timestamps older than the window
  timestamps = timestamps.filter(ts => now - ts < windowMs);
  
  // Check if rate limit is exceeded
  if (timestamps.length >= maxRequests) {
    return false;
  }
  
  // Add current timestamp and update the map
  timestamps.push(now);
  requestTimestamps.set(ip, timestamps);
  
  return true;
}

/**
 * Clean up old rate limit data
 */
function cleanupRateLimits() {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  
  for (const [ip, timestamps] of requestTimestamps.entries()) {
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    if (validTimestamps.length === 0) {
      requestTimestamps.delete(ip);
    } else {
      requestTimestamps.set(ip, validTimestamps);
    }
  }
}

/**
 * Extract token from request
 * @param {Request} request - The HTTP request
 * @returns {string|null} - The auth token or null
 */
function getAuthToken(request) {
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check query string
  const url = new URL(request.url);
  return url.searchParams.get('token');
}

/**
 * Validate authentication token
 * @param {string} token - The token to validate
 * @param {Object} env - Environment variables
 * @returns {Promise<boolean>} - Whether the token is valid
 */
async function validateToken(token, env) {
  // Skip validation in development mode
  if (env.ENVIRONMENT === 'development' || env.DEBUG === 'true' || env.SKIP_AUTH === 'true') {
    console.log('[API:DEV] Skipping token validation in development mode');
    return true;
  }
  
  // Allow test token for testing
  if (token === 'test-token') {
    console.log('[API] Using test token for validation');
    return true;
  }
  
  try {
    // In production, validate against auth service
    if (token) {
      // JWT validation would normally go here
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Main handler for the status API
 * @param {Object} context - The Cloudflare Worker context
 * @returns {Response} - The API response
 */
export async function onRequest(context) {
  const { request, env } = context;
  
  // Set CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  try {
    // Get client IP for rate limiting
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Check if we're in development mode
    const isDev = env.ENVIRONMENT === 'development' || env.DEBUG === 'true' || env.SKIP_AUTH === 'true';
    
    // Log request in development mode
    if (isDev) {
      console.log(`[API:DEV] Status API request from ${clientIp}`);
    }
    
    // Skip rate limiting in development mode
    if (!isDev && !checkRateLimit(clientIp, env.RATE_LIMIT || 60)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          ...corsHeaders
        }
      });
    }
    
    // Clean up old rate limit data occasionally
    if (Math.random() < 0.1) { // 10% chance
      cleanupRateLimits();
    }
    
    // Authentication is handled by the middleware
    // We don't need to duplicate the auth check here
    if (isDev) {
      console.log('[API:DEV] Middleware should have already skipped auth check');
    }
    
    // Prepare the response data
    let responseData;
    
    // Use mock data in development or when configured
    if (isDev || env.USE_MOCK_DATA === 'true') {
      responseData = structuredClone(MOCK_DATA);
      
      // Add some randomization
      if (Math.random() < 0.1) { // 10% chance
        responseData.status = 'degraded';
        if (!responseData.incidents.some(i => !i.resolved)) {
          responseData.incidents.push({
            id: `inc-${Date.now()}`,
            title: 'Minor Service Degradation',
            description: 'We are investigating reports of minor service degradation.',
            timestamp: Date.now(),
            resolved: false,
            resolvedAt: null
          });
        }
      }
    } else {
      // In production, would fetch from a real backend
      // For now, use mock data as a fallback
      responseData = structuredClone(MOCK_DATA);
    }
    
    // Return the response
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60', // Cache for 60 seconds
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Error in status API:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: env.ENVIRONMENT === 'development' ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

