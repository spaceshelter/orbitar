// Orbitar OAuth2 Client Example
// This demonstrates the complete OAuth2 flow for a simple NodeJS application

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');
const https = require('https');

// Create axios instance that ignores self-signed certificates (for development only)
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false // Ignore self-signed certificates (DEVELOPMENT ONLY)
  })
});

// Configuration
const config = {
  // Replace with your client credentials
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  
  // Application settings
  port: 3000,
  scope: 'status',
  redirectUri: 'http://localhost:3000/callback',
  
  // This would be your Initial Authorization URL in the client app settings
  // In a real application, you would set this to http://localhost:3000/start
  // when registering your OAuth2 client on Orbitar
  initialAuthUrl: 'http://localhost:3000/start',
  
  // Orbitar endpoints
  authorizationEndpoint: 'https://orbitar.local/oauth2/authorize',
  tokenEndpoint: 'https://api.orbitar.local/api/v1/oauth2/token',
  apiEndpoint: 'https://api.orbitar.local/api/v1/status'
};

// Initialize Express app
const app = express();

// Set up session
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: true
}));

// Main route - Home page
app.get('/', (req, res) => {
  let content = `
    <h1>Orbitar OAuth2 Client Example</h1>
    
    <p>This app demonstrates the OAuth2 flow for Orbitar.</p>
  `;
  
  // Check if user is authenticated
  if (req.session.tokens) {
    content += `
      <p><strong>You are authenticated!</strong></p>
      <button onclick="location.href='/status'">Check Status</button>
      <button onclick="location.href='/logout'">Logout</button>
    `;
  } else {
    content += `
      <p>You can start the OAuth2 flow in two ways:</p>
      <button onclick="location.href='/login'">Authorize with Orbitar</button>
      <button onclick="location.href='/start'">Use Initial Authorization URL</button>
    `;
  }
  
  res.send(content);
});

// Regular OAuth2 flow - directly to authorization endpoint
app.get('/login', (req, res) => {
  // Generate and store a state parameter to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  
  // Build authorization URL
  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.append('client_id', config.clientId);
  authUrl.searchParams.append('redirect_uri', config.redirectUri);
  authUrl.searchParams.append('scope', config.scope);
  authUrl.searchParams.append('state', state);
  
  // Redirect user to the authorization endpoint
  res.redirect(authUrl.toString());
});

// Initial Authorization URL endpoint - simulates the "Start" button in app cards
app.get('/start', (req, res) => {
  // This endpoint simulates what would happen when a user clicks 
  // the "Start" button on an embedded app card
  
  let content = `
    <h1>Initial Authorization URL</h1>
    <p>This page simulates the landing page that users would see after clicking 
    the "Start" button on your embedded app card.</p>
    <p>From here, you would typically:</p>
    <ul>
      <li>Show information about your application</li>
      <li>Track analytics data about the visit</li>
      <li>Add custom parameters or state to the flow</li>
    </ul>
    
    <button onclick="location.href='/initiate-auth'">Continue to Authorization</button>
  `;
  
  res.send(content);
});

// Initiate authorization from the initial page
app.get('/initiate-auth', (req, res) => {
  // Generate and store a state parameter to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  
  // Build authorization URL
  const authUrl = new URL(config.authorizationEndpoint);
  authUrl.searchParams.append('client_id', config.clientId);
  authUrl.searchParams.append('redirect_uri', config.redirectUri);
  authUrl.searchParams.append('scope', config.scope);
  authUrl.searchParams.append('state', state);
  
  // Redirect user to the authorization endpoint
  res.redirect(authUrl.toString());
});

// OAuth2 callback handler
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Verify state parameter to prevent CSRF
  if (!state || state !== req.session.oauthState) {
    return res.status(403).send('State validation failed');
  }
  
  try {
    // Exchange authorization code for tokens
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    
    // Create form data for x-www-form-urlencoded content type
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', config.redirectUri);
    params.append('nonce', crypto.randomBytes(16).toString('hex'));
    
    const tokenResponse = await axiosInstance.post(config.tokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      }
    });
    
    // Store tokens in session
    req.session.tokens = {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      scope: tokenResponse.data.scope
    };
    
    res.redirect('/');
  } catch (error) {
    console.error('Error exchanging authorization code for tokens:', error.response?.data || error.message);
    res.status(500).send('Error during authorization. Check console for details.');
  }
});

// API call example
app.get('/status', async (req, res) => {
  // Check if user is authenticated
  if (!req.session.tokens) {
    return res.redirect('/login');
  }
  
  try {
    // Call API with access token (using POST as required)
    const apiResponse = await axiosInstance.post(config.apiEndpoint, {}, {
      headers: {
        'Authorization': `Bearer ${req.session.tokens.accessToken}`
      }
    });
    
    // Display API response
    let content = `
      <h1>API Status</h1>
      <pre>${JSON.stringify(apiResponse.data, null, 2)}</pre>
      <button onclick="location.href='/'">Back to Home</button>
    `;
    
    res.send(content);
  } catch (error) {
    // Check if token needs to be refreshed (401 Unauthorized)
    if (error.response && error.response.status === 401) {
      try {
        await refreshTokens(req);
        return res.redirect('/status'); // Retry after refreshing tokens
      } catch (refreshError) {
        // If refresh fails, redirect to login
        req.session.tokens = null;
        return res.redirect('/login');
      }
    }
    
    console.error('API call error:', error.response?.data || error.message);
    res.status(500).send('Error calling API. Check console for details.');
  }
});

// Token refresh function
async function refreshTokens(req) {
  if (!req.session.tokens || !req.session.tokens.refreshToken) {
    throw new Error('No refresh token available');
  }
  
  // Create form data for x-www-form-urlencoded content type
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  
  const refreshResponse = await axiosInstance.post(config.tokenEndpoint, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${req.session.tokens.refreshToken}`
    }
  });
  
  // Update tokens in session
  req.session.tokens = {
    accessToken: refreshResponse.data.access_token,
    refreshToken: refreshResponse.data.refresh_token,
    scope: refreshResponse.data.scope
  };
  
  return req.session.tokens;
}

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start server
app.listen(config.port, () => {
  console.log(`OAuth2 client example running at http://localhost:${config.port}`);
  console.log(`This example is configured to ignore SSL certificate validation for development.`);
  console.log(`DO NOT use this approach in production environments.`);
});