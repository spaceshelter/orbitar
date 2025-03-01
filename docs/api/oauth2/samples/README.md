# Orbitar OAuth2 Client Samples

This directory contains sample OAuth2 client applications in various languages that demonstrate the complete OAuth2 flow for Orbitar.

## Available Samples

### Node.js

**File:** `nodejs-oauth2-client.js`

A complete Express.js application that demonstrates:
- Authorization code flow
- Token exchange
- API requests with access tokens
- Token refresh
- Embedded app card landing page simulation

**Requirements:**
- Node.js 14+
- npm packages: express, express-session, axios

**Running the sample:**
```
npm install express express-session axios
node nodejs-oauth2-client.js
```

### PHP

**File:** `php-oauth2-client.php`

A single-file PHP application that demonstrates:
- Authorization code flow
- Token exchange
- API requests with access tokens
- Token refresh
- Embedded app card landing page simulation

**Requirements:**
- PHP 7.4+
- PHP Extensions: curl, json, session

**Running the sample:**
```
# Using PHP's built-in server
php -S localhost:3000
```

For PHP deployment, you need to create symlinks or copy the file to several names:
- index.php
- login.php
- start.php
- initiate-auth.php
- callback.php
- status.php
- logout.php

## Configuration

All samples use the same configuration structure:

```
clientId: 'YOUR_CLIENT_ID',           // Your OAuth2 client ID
clientSecret: 'YOUR_CLIENT_SECRET',    // Your OAuth2 client secret
scope: 'status',                       // The scope(s) you want to request
redirectUri: 'http://localhost:3000/callback',  // Your redirect URI
```

They are all configured to connect to:
- https://orbitar.local (authorization endpoint)
- https://api.orbitar.local/api/v1 (API endpoints)

## Security Notes

These samples disable SSL certificate verification for ease of development. This is **NOT** suitable for production. In a production environment:

1. Ensure proper SSL certificate validation
2. Store client secrets securely
3. Use HTTPS for all communication
4. Implement proper state validation and CSRF protection
5. Use secure, randomly generated session keys