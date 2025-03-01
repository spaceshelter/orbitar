# OAuth2 Developer Guide

## Introduction

OAuth2 allows Orbitar users to create client applications and let other users connect to them in a secure way. This guide will help you understand how to create and use OAuth2 client applications.

## Creating a Client Application

To create a client application, follow these steps:

1. Log in to your Orbitar account
2. Go to your profile, then enter Settings
3. Click "Зарегистрировать своё приложение" button at the bottom of the page
4. Fill in the required information:
   - **Name**: Your application name (2-32 characters)
   - **Description**: What your app does (up to 255 characters)
   - **Redirect URIs**: Where users will be sent after authorization (comma-separated list)
   - **Initial Authorization URL** (optional): Where users start the authorization process. If provided, a "Start" button will appear on your app card, allowing users to be redirected directly to this URL.

After creating your application, you will receive:
- **Client ID**: Public identifier for your application
- **Client Secret**: Private key that must be kept secure

**Important**: 
1. Store your Client Secret safely. If you lose it or need to change it for security reasons, you can regenerate it in your application settings.
2. After creating your application, you can upload a logo for it. You cannot upload a logo during the initial creation process.

## Promoting Your Application

You can promote your application to other Orbitar users by embedding app cards in posts or comments.

To embed your app card, use this format:
```
<app>{client_id}</app>
```

Replace `{client_id}` with your actual client ID. For example:
```
<app>550e8400-e29b-41d4-a716-446655440000</app>
```

The embedded card will show:
- Your app name
- Description
- Logo (if you uploaded one)
- "Start" button (if you provided an Initial Authorization URL)

Users can click the "Start" button to be redirected to your Initial Authorization URL, beginning the OAuth2 flow.

## Understanding OAuth2 Flow

OAuth2 in Orbitar uses the ["Authorization Code" flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow), which is [defined in RFC 6749, section 4.1](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1):

1. **Authorization Request**: Your app asks the user for permission
2. **Authorization Grant**: User approves the request
3. **Code Redirect**: Orbitar redirects to your app with an authorization code
4. **Token Exchange**: Your app exchanges the code for access tokens
5. **API Access**: Your app uses the access token to make API requests

### Step 1: Authorization Request

Redirect the user to Orbitar's authorization endpoint:

```
https://orbitar.space/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=REQUESTED_SCOPES&redirect_uri=YOUR_REDIRECT_URI
```

Parameters:
- `client_id`: Your application's Client ID
- `scope`: Space-separated list of permissions your app needs
- `redirect_uri`: Must match one of the URIs you registered

**Note**: If you provided an Initial Authorization URL when creating your app, you have two options:
1. Set it directly to Orbitar's authorization endpoint with the parameters above
2. Set it to a URL on your app that will then redirect users to Orbitar's authorization endpoint

The second option gives you more control, allowing you to track analytics or add custom parameters before redirecting to Orbitar. When users click the "Start" button on your embedded app card, they will first go to your Initial Authorization URL.

### Step 2: User Authorization

The user will see a consent screen showing:
- Your application name and description
- Your username (the developer/creator of the application)
- The permissions your app is requesting
- Buttons to approve or deny

### Step 3: Authorization Code

If the user approves, Orbitar will redirect to your `redirect_uri` with an authorization code:

```
https://your-app.example/callback?authorizationCode=CODE
```

This code is temporary and expires quickly.

### Step 4: Token Exchange

Your application must exchange this code for access and refresh tokens by making a POST request with Basic authentication:

```
POST https://api.orbitar.space/api/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic BASE64(CLIENT_ID:CLIENT_SECRET)

grant_type=authorization_code&code=AUTHORIZATION_CODE&nonce=RANDOM_STRING&redirect_uri=YOUR_REDIRECT_URI
```

The response contains:
```json
{
  "access_token": "ACCESS_TOKEN",
  "refresh_token": "REFRESH_TOKEN",
  "scope": "GRANTED_SCOPES"
}
```

### Step 5: Using Access Tokens

Include the access token in API requests to Orbitar:

```
POST https://api.orbitar.space/api/v1/status
Authorization: Bearer ACCESS_TOKEN
```

**Note**: Make sure the scopes you requested during authorization include access to the endpoints you plan to use. For example, to access the `/api/v1/status` endpoint, your authorized scopes must include permission for this resource.

### Step 6: Refreshing Tokens

Access tokens expire after a period of time (usually 1 hour). Use the refresh token to get a new access token:

```
POST https://api.orbitar.space/api/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Bearer REFRESH_TOKEN

grant_type=refresh_token
```

If the refresh token has expired, you'll need to initiate a new authorization flow for the user starting from Step 1.

## Scopes

Scopes define what your application can access. Some common scopes include:

- `feed`: Access to user's feed
- `profile`: Access to user profile information
- `post`: Create and edit posts
- `vote`: Vote on posts and comments

Request only the minimum scopes your application needs.

## Security Best Practices

1. **Keep Client Secret secure**: Never expose it in client-side code
2. **Use HTTPS**: Always use secure connections
3. **Validate redirect URIs**: Prevent open redirector attacks
4. **Request minimum scopes**: Only ask for permissions you need
5. **Handle token expiration**: Properly refresh tokens when needed
6. **Revoke tokens**: When a user uninstalls or logs out of your app

## Troubleshooting

Common issues and solutions:

- **Invalid redirect URI**: Make sure the URI matches exactly what you registered
- **Invalid client credentials**: Check your client ID and secret
- **Invalid scopes**: Make sure requested scopes are valid
- **Expired authorization code**: Codes expire quickly, exchange them immediately
- **Expired access token**: Use refresh token to get a new access token

## Sample Applications

We provide complete sample applications that demonstrate the full OAuth2 flow in different programming languages. These samples include:

- Authorization code flow
- Token exchange
- API requests with access tokens
- Token refresh
- Embedded app card landing page simulation

### Available Samples

- **Node.js**: A complete Express.js application
- **Python**: A Flask-based web application
- **PHP**: A single-file PHP application

All samples implement the same functionality and follow best practices for OAuth2 implementation.

For detailed instructions and to view the sample code, see the [Samples](samples/) directory.

## Further Resources


- [OAuth2 Specification](https://oauth.net/2/)
