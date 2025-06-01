/**
 * Global middleware for Cloudflare Pages Functions
 * Handles authentication, logging, and error handling
 */

/**
 * Log request details
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 */
function logRequest(request, env) {
  // Skip detailed logging in production
  if (env.ENVIRONMENT === 'production' && env.DEBUG !== 'true') {
    return;
  }
  
  const url = new URL(request.url);
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - IP: ${clientIp}, UA: ${userAgent}`);
}

/**
 * Main middleware handler
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  
  // Log the incoming request
  logRequest(request, env);
  
  // Skip other middleware steps for asset requests
  const url = new URL(request.url);
  if (url.pathname.startsWith('/assets/') || 
      url.pathname.endsWith('.css') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.ico')) {
    return next();
  }
  
  // Continue to the next handler
  try {
    return await next();
  } catch (error) {
    // Global error handler
    console.error('Unhandled error in request:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: env.ENVIRONMENT === 'development' ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * Middleware for Cloudflare Pages Functions
 * Handles authentication, logging, error handling, and rate limiting
 */

// Map to store request counts for rate limiting
const requestCounts = new Map();

/**
 * Validates an authentication token
 * @param {string} token - The token to validate
 * @param {Object} env - Environment variables
 * @returns {Promise<boolean>} Whether the token is valid
 */
async function validateToken(token, env) {
  // Skip validation in development mode if configured
  if (env.ENVIRONMENT === 'development' && env.SKIP_AUTH === 'true') {
    return true;
  }
  
  // Allow a test token for development purposes
  if (env.ENVIRONMENT === 'development' && token === 'test-token') {
    return true;
  }
  
  try {
    // In production, validate against auth service
    if (token) {
      const authDomain = env.AUTH_DOMAIN || 'auth.noxhime.com';
      const response = await fetch(`https://${authDomain}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.valid === true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Checks if a request is under rate limits
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @returns {boolean} Whether the request is allowed
 */
function checkRateLimit(request, env) {
  // Skip rate limiting in development
  if (env.ENVIRONMENT === 'development') {
    return true;
  }
  
  // Get client IP (using CF-Connecting-IP header which Cloudflare sets)
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  // Get current timestamp rounded to the nearest minute for rate limiting window
  const now = Math.floor(Date.now() / 60000);
  
  // Clear old entries (simple cleanup)
  for (const [key, value] of requestCounts.entries()) {
    if (value.timestamp < now - 5) { // Remove entries older than 5 minutes
      requestCounts.delete(key);
    }
  }
  
  // Get or create counter for this IP
  const counter = requestCounts.get(clientIp) || { count: 0, timestamp: now };
  
  // Reset counter if it's from a different minute
  if (counter.timestamp !== now) {
    counter.count = 0;
    counter.timestamp = now;
  }
  
  // Increment counter
  counter.count++;
  
  // Store updated counter
  requestCounts.set(clientIp, counter);
  
  // Check if rate limit is exceeded
  const rateLimit = parseInt(env.RATE_LIMIT || '60', 10); // Default: 60 requests per minute
  return counter.count <= rateLimit;
}

/**
 * Logs request details
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 */
function logRequest(request, env) {
  // Skip detailed logging in production to reduce noise
  if (env.ENVIRONMENT === 'production' && env.DEBUG !== 'true') {
    return;
  }
  
  const url = new URL(request.url);
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - IP: ${clientIp}, UA: ${userAgent}`);
}

/**
 * Main middleware handler
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  
  // Log the incoming request
  logRequest(request, env);
  
  // Check rate limiting
  if (!checkRateLimit(request, env)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Retry-After': '60'
      }
    });
  }
  
  // Skip auth for OPTIONS requests (CORS preflight)
  if (request.method === 'OPTIONS') {
    return next();
  }
  
  // Skip auth for public routes
  const url = new URL(request.url);
  if (url.pathname === '/' || 
      url.pathname.startsWith('/assets/') || 
      url.pathname.startsWith('/public/') ||
      url.pathname === '/styles.css' ||
      url.pathname === '/dashboard.js') {
    return next();
  }
  
  // Validate auth token for protected routes
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  
  // If no token provided via header, check for token in query string
  // (useful for development and testing)
  let queryToken = '';
  if (!token && url.searchParams.has('token')) {
    queryToken = url.searchParams.get('token');
  }
  
  const isValidToken = await validateToken(token || queryToken, env);
  
  if (!isValidToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  try {
    // Continue to the next handler
    return await next();
  } catch (error) {
    // Global error handler
    console.error('Unhandled error in request:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: env.ENVIRONMENT === 'development' ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

