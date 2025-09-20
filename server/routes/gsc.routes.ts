// server/routes/gsc.routes.ts - Complete version with sanitization
import { Router, Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { gscStorage } from '../services/gsc-storage';
import { requireAuth } from '../middleware/auth';
import { InputSanitizer, sanitizationMiddleware } from '../utils/sanitizer';
import rateLimit from 'express-rate-limit';

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later'
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: 'Too many requests, please slow down'
});

// Extend Request type
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

const router = Router();

// Apply middleware
router.use(apiLimiter);
router.use(sanitizationMiddleware.body);
router.use(sanitizationMiddleware.query);
router.use(sanitizationMiddleware.params);

const gscUserTokens = new Map<string, any>();

const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/indexing',
  'https://www.googleapis.com/auth/siteverification',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Helper function to get redirect URI
const getRedirectUri = () => {
  return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/gsc/oauth-callback';
};

// Input validation middleware for OAuth credentials
const validateOAuthConfig = (req: Request, res: Response, next: NextFunction) => {
  const { clientId, clientSecret } = req.body;
  
  const validation = InputSanitizer.sanitizeOAuthCredentials(clientId, clientSecret);
  
  if (!validation.isValid) {
    return res.status(400).json({ 
      error: 'Invalid OAuth credentials',
      details: validation.errors 
    });
  }
  
  req.body.clientId = validation.sanitizedId;
  req.body.clientSecret = validation.sanitizedSecret;
  next();
};

const validateAccountId = (req: Request, res: Response, next: NextFunction) => {
  const accountId = req.body.accountId || req.query.accountId;
  
  if (!accountId) {
    return res.status(400).json({ error: 'Account ID is required' });
  }
  
  const validation = InputSanitizer.sanitizeAccountId(accountId as string);
  
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }
  
  if (req.body.accountId) req.body.accountId = validation.sanitized;
  if (req.query.accountId) req.query.accountId = validation.sanitized;
  next();
};

// Configuration endpoint - Save user's OAuth credentials
router.post('/configure', requireAuth, validateOAuthConfig, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { clientId, clientSecret } = req.body; // Already sanitized by middleware

    // Get redirect URI from environment - no validation needed for our own config
    const redirectUri = getRedirectUri();

    console.log('📝 Saving GSC configuration for user:', userId);
    console.log('📝 Using redirect URI:', redirectUri);

    // Save configuration to database WITHOUT validating the redirect URI
    await gscStorage.saveGscConfiguration(userId, {
      clientId,
      clientSecret,
      redirectUri
    });

    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error: any) {
    console.error('Config save error:', error);
    res.status(500).json({ error: error.message || 'Failed to save configuration' });
  }
});

// Get OAuth URL - Uses saved configuration
router.get('/auth-url', requireAuth, authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    console.log(`🔐 Generating GSC OAuth URL for user: ${userId}`);
    
    // Get saved configuration
    const config = await gscStorage.getGscConfiguration(userId);
    
    if (!config) {
      return res.status(400).json({ 
        error: 'No configuration found. Please configure your Google OAuth credentials first.' 
      });
    }
    
    // Create OAuth client with saved credentials
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri || getRedirectUri()
    );
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GSC_SCOPES,
      prompt: 'consent',
      state: userId
    });
    
    res.json({ authUrl });
  } catch (error) {
    console.error('GSC auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// POST version for compatibility if frontend sends credentials
router.post('/auth-url', requireAuth, authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let { clientId, clientSecret } = req.body;
    
    console.log(`🔐 Generating GSC OAuth URL for user: ${userId}`);
    
    // If credentials provided, validate and save them first
    if (clientId && clientSecret) {
      const validation = InputSanitizer.sanitizeOAuthCredentials(clientId, clientSecret);
      
      if (!validation.isValid) {
        return res.status(400).json({ 
          error: 'Invalid OAuth credentials',
          details: validation.errors 
        });
      }
      
      clientId = validation.sanitizedId;
      clientSecret = validation.sanitizedSecret;
      
      // Get redirect URI - no validation needed
      const redirectUri = getRedirectUri();
      
      await gscStorage.saveGscConfiguration(userId, {
        clientId,
        clientSecret,
        redirectUri
      });
    }
    
    // Get configuration
    const config = await gscStorage.getGscConfiguration(userId);
    
    if (!config) {
      return res.status(400).json({ 
        error: 'No configuration found. Please provide OAuth credentials.' 
      });
    }
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri || getRedirectUri()
    );
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GSC_SCOPES,
      prompt: 'consent',
      state: userId
    });
    
    res.json({ authUrl });
  } catch (error) {
    console.error('GSC auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Exchange code for tokens
router.post('/auth', requireAuth, authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { code, state } = req.body;
    
    console.log(`🔐 Exchanging GSC auth code for user: ${userId}`);
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code required' });
    }
    
    // Basic sanitization of auth code
    const sanitizedCode = code.trim();
    if (!sanitizedCode || sanitizedCode.length < 10) {
      return res.status(400).json({ error: 'Invalid authorization code' });
    }
    
    // Get saved configuration
    const config = await gscStorage.getGscConfiguration(userId);
    
    if (!config) {
      return res.status(400).json({ 
        error: 'Configuration not found. Please configure OAuth credentials first.' 
      });
    }
    
    // Create OAuth2 client with saved credentials
    const authClient = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri || getRedirectUri()
    );
    
    try {
      const { tokens } = await authClient.getToken(sanitizedCode);
      
      if (!tokens.access_token) {
        console.error('No access token received');
        return res.status(400).json({ error: 'Failed to obtain access token' });
      }
      
      authClient.setCredentials(tokens);
      
      // Get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
      const { data: userInfo } = await oauth2.userinfo.get();
      
      // Sanitize user info
      const emailValidation = InputSanitizer.sanitizeEmail(userInfo.email || '');
      if (!emailValidation.isValid) {
        return res.status(400).json({ error: 'Invalid email received from Google' });
      }
      
      // Store account
      const gscAccount = {
        id: userInfo.id!,
        email: emailValidation.sanitized,
        name: InputSanitizer.sanitizeTextSimple(userInfo.name || emailValidation.sanitized),
        picture: userInfo.picture || undefined,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || '',
        tokenExpiry: tokens.expiry_date || Date.now() + 3600000,
        isActive: true
      };
      
      // Store in memory cache
      gscUserTokens.set(`${userId}_${userInfo.id}`, tokens);
      
      // Save to database
      await gscStorage.saveGscAccount(userId, gscAccount);
      
      console.log(`✅ GSC account connected: ${emailValidation.sanitized}`);
      res.json({ account: gscAccount });
      
    } catch (tokenError: any) {
      if (tokenError.message?.includes('invalid_grant')) {
        console.error('Invalid grant - code may have been used or expired');
        return res.status(400).json({ 
          error: 'Authorization code expired or already used. Please try signing in again.' 
        });
      }
      if (tokenError.message?.includes('redirect_uri_mismatch')) {
        console.error('Redirect URI mismatch during token exchange');
        return res.status(400).json({ 
          error: 'Configuration error. Please check your redirect URI.' 
        });
      }
      throw tokenError;
    }
  } catch (error: any) {
    console.error('GSC auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Get properties
router.get('/properties', requireAuth, validateAccountId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { accountId } = req.query; // Already sanitized by middleware
    
    // Get account with credentials using the join method
    const account = await gscStorage.getGscAccountWithCredentials(userId, accountId as string);
    
    if (!account) {
      return res.status(401).json({ error: 'Account not found or not authenticated' });
    }
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      account.clientId,
      account.clientSecret,
      account.redirectUri || getRedirectUri()
    );
    
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiry
    });
    
    // Get properties from Search Console
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    const { data } = await searchconsole.sites.list();
    
    // Save properties to database
    for (const site of (data.siteEntry || [])) {
      await gscStorage.saveGscProperty(userId, accountId as string, {
        siteUrl: site.siteUrl!,
        permissionLevel: site.permissionLevel!,
        siteType: site.siteUrl?.startsWith('sc-domain:') ? 'DOMAIN' : 'SITE',
        verified: true
      });
    }
    
    const properties = (data.siteEntry || []).map(site => ({
      siteUrl: site.siteUrl!,
      permissionLevel: site.permissionLevel!,
      siteType: site.siteUrl?.startsWith('sc-domain:') ? 'DOMAIN' as const : 'SITE' as const,
      verified: true,
      accountId: accountId
    }));
    
    console.log(`✅ Found ${properties.length} GSC properties`);
    res.json(properties);
  } catch (error) {
    console.error('Error fetching GSC properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Submit URL for indexing
router.post('/index', requireAuth, validateAccountId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { accountId, url, type = 'URL_UPDATED' } = req.body; // Already sanitized
    
    console.log(`📤 Submitting URL for indexing: ${url} (${type})`);
    
    // Validate type
    if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
      return res.status(400).json({ error: 'Invalid type. Must be URL_UPDATED or URL_DELETED' });
    }
    
    // Check quota
    const quota = await gscStorage.getGscQuotaUsage(accountId);
    if (quota.used >= quota.limit) {
      return res.status(429).json({ error: 'Daily quota exceeded (200 URLs/day)' });
    }
    
    // Get account with credentials
    const account = await gscStorage.getGscAccountWithCredentials(userId, accountId);
    
    if (!account) {
      return res.status(401).json({ error: 'Account not found or not authenticated' });
    }
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      account.clientId,
      account.clientSecret,
      account.redirectUri || getRedirectUri()
    );
    
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiry
    });
    
    // Use Indexing API
    const indexing = google.indexing({ version: 'v3', auth: oauth2Client });
    
    try {
      const result = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: type
        }
      });
      
      // Track quota usage
      await gscStorage.incrementGscQuotaUsage(accountId, url);
      
      console.log(`✅ URL submitted for indexing: ${url}`);
      res.json({
        success: true,
        notifyTime: result.data.urlNotificationMetadata?.latestUpdate?.notifyTime,
        url: url
      });
      
    } catch (indexError: any) {
      if (indexError.code === 429) {
        return res.status(429).json({ error: 'Daily quota exceeded (200 URLs/day)' });
      }
      throw indexError;
    }
    
  } catch (error) {
    console.error('Indexing error:', error);
    res.status(500).json({ error: 'Failed to submit URL for indexing' });
  }
});

// URL Inspection
router.post('/inspect', requireAuth, validateAccountId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { accountId, siteUrl, inspectionUrl } = req.body;
    
    console.log(`🔍 Inspecting URL: ${inspectionUrl}`);
    
    if (!siteUrl || !inspectionUrl) {
      return res.status(400).json({ error: 'Site URL and inspection URL required' });
    }
    
    // Get account with credentials
    const account = await gscStorage.getGscAccountWithCredentials(userId, accountId);
    
    if (!account) {
      return res.status(401).json({ error: 'Account not found or not authenticated' });
    }
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      account.clientId,
      account.clientSecret,
      account.redirectUri || getRedirectUri()
    );
    
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiry
    });
    
    // Use URL Inspection API
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    
    const result = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: inspectionUrl,
        siteUrl: siteUrl
      }
    });
    
    const inspection = result.data.inspectionResult;
    
    // Transform result
    const inspectionResult = {
      url: inspectionUrl,
      indexStatus: inspection?.indexStatusResult?.coverageState || 'NOT_INDEXED',
      lastCrawlTime: inspection?.indexStatusResult?.lastCrawlTime,
      pageFetchState: inspection?.indexStatusResult?.pageFetchState,
      googleCanonical: inspection?.indexStatusResult?.googleCanonical,
      userCanonical: inspection?.indexStatusResult?.userCanonical,
      sitemap: inspection?.indexStatusResult?.sitemap,
      mobileUsability: inspection?.mobileUsabilityResult?.verdict || 'NEUTRAL',
      richResultsStatus: inspection?.richResultsResult?.verdict
    };
    
    // Save inspection result to database
    const properties = await gscStorage.getGscProperties(userId, accountId);
    const property = properties.find((p: any) => p.site_url === siteUrl);
    if (property) {
      await gscStorage.saveUrlInspection(property.id, inspectionResult);
    }
    
    console.log(`✅ URL inspection complete: ${inspectionResult.indexStatus}`);
    res.json(inspectionResult);
    
  } catch (error) {
    console.error('Inspection error:', error);
    res.status(500).json({ error: 'Failed to inspect URL' });
  }
});

// Submit Sitemap
router.post('/sitemap', requireAuth, validateAccountId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { accountId, siteUrl, sitemapUrl } = req.body;
    
    console.log(`📄 Submitting sitemap: ${sitemapUrl}`);
    
    if (!siteUrl || !sitemapUrl) {
      return res.status(400).json({ error: 'Site URL and sitemap URL required' });
    }
    
    // Get account with credentials
    const account = await gscStorage.getGscAccountWithCredentials(userId, accountId);
    
    if (!account) {
      return res.status(401).json({ error: 'Account not found or not authenticated' });
    }
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      account.clientId,
      account.clientSecret,
      account.redirectUri || getRedirectUri()
    );
    
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiry
    });
    
    // Submit sitemap
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    
    await searchconsole.sitemaps.submit({
      siteUrl: siteUrl,
      feedpath: sitemapUrl
    });
    
    // Save to database
    const properties = await gscStorage.getGscProperties(userId, accountId);
    const property = properties.find((p: any) => p.site_url === siteUrl);
    if (property) {
      await gscStorage.saveSitemap(property.id, sitemapUrl);
    }
    
    console.log(`✅ Sitemap submitted: ${sitemapUrl}`);
    res.json({
      success: true,
      message: 'Sitemap submitted successfully'
    });
    
  } catch (error) {
    console.error('Sitemap submission error:', error);
    res.status(500).json({ error: 'Failed to submit sitemap' });
  }
});

// Get Performance Data
router.get('/performance', requireAuth, validateAccountId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let { accountId, siteUrl, days = '28' } = req.query;
    
    console.log(`📊 Fetching performance data for: ${siteUrl}`);
    
    if (!siteUrl || typeof siteUrl !== 'string') {
      return res.status(400).json({ error: 'Site URL is required' });
    }
    
    // Validate days parameter
    const daysNum = parseInt(typeof days === 'string' ? days : '28');
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
      return res.status(400).json({ error: 'Days must be between 1 and 90' });
    }
    
    // Get account with credentials
    const account = await gscStorage.getGscAccountWithCredentials(userId, accountId as string);
    
    if (!account) {
      return res.status(401).json({ error: 'Account not found or not authenticated' });
    }
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      account.clientId,
      account.clientSecret,
      account.redirectUri || getRedirectUri()
    );
    
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiry
    });
    
    // Get performance data
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    
    const result = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['date'],
        metrics: ['clicks', 'impressions', 'ctr', 'position'],
        rowLimit: 1000
      }
    });
    
    const performanceData = (result.data.rows || []).map(row => ({
      date: row.keys?.[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0
    }));
    
    // Save performance data to database
    const properties = await gscStorage.getGscProperties(userId, accountId as string);
    const property = properties.find((p: any) => p.site_url === siteUrl);
    if (property) {
      await gscStorage.savePerformanceData(property.id, performanceData);
    }
    
    console.log(`✅ Performance data fetched: ${performanceData.length} days`);
    res.json(performanceData);
    
  } catch (error) {
    console.error('Performance data error:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// Refresh Token
router.post('/refresh-token', requireAuth, validateAccountId, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { accountId, refreshToken } = req.body;
    
    console.log(`🔄 Refreshing GSC token for account: ${accountId}`);
    
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Get configuration
    const config = await gscStorage.getGscConfiguration(userId);
    if (!config) {
      return res.status(400).json({ error: 'Configuration not found' });
    }
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri || getRedirectUri()
    );
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Update stored tokens
    await gscStorage.updateGscAccount(userId, accountId, {
      accessToken: credentials.access_token!,
      tokenExpiry: credentials.expiry_date!
    });
    
    console.log(`✅ GSC token refreshed for account: ${accountId}`);
    res.json({ 
      accessToken: credentials.access_token,
      tokenExpiry: credentials.expiry_date
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// OAuth Callback Handler - FIXED with better window communication
router.get('/oauth-callback', async (req: Request, res: Response) => {
  try {
    // Set headers to allow popup communication
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    
    const { code, state, error } = req.query;
    
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    
    if (error) {
      const safeError = InputSanitizer.escapeHtml(error as string);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: system-ui; padding: 20px; text-align: center; }
            .error { color: #dc2626; }
          </style>
        </head>
        <body>
          <h2 class="error">Authentication Failed</h2>
          <p>${safeError}</p>
          <script>
            // Try multiple communication methods
            const error = ${JSON.stringify(safeError)};
            
            // Method 1: PostMessage
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_ERROR', 
                error: error 
              }, '${clientUrl}');
            }
            
            // Method 2: LocalStorage
            localStorage.setItem('gsc_auth_error', JSON.stringify({
              error: error,
              timestamp: Date.now()
            }));
            
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `);
    }
    
    if (!code) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: system-ui; padding: 20px; text-align: center; }
            .error { color: #dc2626; }
          </style>
        </head>
        <body>
          <h2 class="error">Missing Authorization Code</h2>
          <p>The authentication process didn't complete properly.</p>
          <script>
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_ERROR', 
                error: 'Missing authorization code' 
              }, '${clientUrl}');
            }
            localStorage.setItem('gsc_auth_error', JSON.stringify({
              error: 'Missing authorization code',
              timestamp: Date.now()
            }));
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `);
    }
    
    // Success - send code to parent window
    const safeCode = InputSanitizer.escapeHtml(code as string);
    const safeState = state ? InputSanitizer.escapeHtml(state as string) : '';
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { 
            font-family: system-ui; 
            padding: 20px; 
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            background: white;
            color: #333;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .success { color: #059669; }
          button {
            margin-top: 20px;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          }
          button:hover { background: #5a67d8; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="success">✅ Authentication Successful!</h2>
          <p>Completing the authentication process...</p>
          <p>This window should close automatically.</p>
          <button onclick="closeWindow()">Close Window</button>
        </div>
        <script>
          const code = ${JSON.stringify(safeCode)};
          const state = ${JSON.stringify(safeState)};
          
          // Method 1: PostMessage to opener
          function sendToOpener() {
            if (window.opener && !window.opener.closed) {
              // Try multiple origins
              ['${clientUrl}', window.location.origin, '*'].forEach(origin => {
                try {
                  window.opener.postMessage({ 
                    type: 'GOOGLE_AUTH_SUCCESS', 
                    code: code,
                    state: state
                  }, origin);
                } catch(e) {}
              });
            }
          }
          
          // Method 2: LocalStorage for same-origin
          function saveToStorage() {
            try {
              localStorage.setItem('gsc_auth_result', JSON.stringify({
                type: 'GOOGLE_AUTH_SUCCESS',
                code: code,
                state: state,
                timestamp: Date.now()
              }));
              
              // Trigger storage event
              window.dispatchEvent(new StorageEvent('storage', {
                key: 'gsc_auth_result',
                newValue: JSON.stringify({
                  type: 'GOOGLE_AUTH_SUCCESS',
                  code: code,
                  state: state,
                  timestamp: Date.now()
                })
              }));
            } catch(e) {}
          }
          
          // Method 3: BroadcastChannel
          function broadcastMessage() {
            try {
              const channel = new BroadcastChannel('gsc_auth');
              channel.postMessage({
                type: 'GOOGLE_AUTH_SUCCESS',
                code: code,
                state: state
              });
              channel.close();
            } catch(e) {}
          }
          
          // Send using all methods
          sendToOpener();
          saveToStorage();
          broadcastMessage();
          
          // Close window function
          function closeWindow() {
            window.close();
            // Fallback redirect if close doesn't work
            setTimeout(() => {
              window.location.href = '${clientUrl}';
            }, 100);
          }
          
          // Auto close after 2 seconds
          setTimeout(closeWindow, 2000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

export default router;
