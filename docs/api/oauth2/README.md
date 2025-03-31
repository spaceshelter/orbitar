# OAuth2 Developer Guide

## Introduction

OAuth2 allows Orbitar users to create client applications and let other users connect to them securely.

A client application is a software program that accesses resources or services on behalf of a user through the OAuth2
protocol. In the Orbitar ecosystem, client applications can use Orbitar's API after getting authorization
from users. These applications can be web apps, mobile apps, desktop applications, or server-side applications that
connect with Orbitar's platform.

This guide will help you understand how to create and use OAuth2 client applications.

## Creating a Client Application

To create a client application, follow these steps:

1. Log in to your Orbitar account
2. Go to your profile, then enter Settings / Applications
3. Click "Зарегистрировать своё приложение" button at the bottom of the page
4. Fill in the required information:
    - **Name**: Your application name (2-32 characters)
    - **Description**: What your app does (up to 255 characters)
    - **Redirect URIs**: Where users will be sent after authorization (comma-separated list)
    - **App connection URL** (optional): The URL where users will go when clicking the "Connect"
      button on your application card. This URL is usually the landing page of your application.

5. After creating your application, you will receive:
    - **Client ID**: Public identifier for your application
    - **Client Secret**: Private key that must be kept secure

**Important**:

1. Store your Client Secret safely. If you lose it or need to change it for security reasons, you can regenerate it in
   your application settings.
2. After creating your application, you can upload a logo for it. You cannot upload a logo during the initial creation
   process.

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
- "Connect" button (if you provided an App connection URL)

## Understanding OAuth2 Flow

OAuth2 in Orbitar uses
the ["Authorization Code" flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow),
which is [defined in RFC 6749, section 4.1](https://datatracker.ietf.org/doc/html/rfc6749#section-4.1):

1. **Authorization Request**: Your app asks the user for permission
2. **Authorization Grant**: User approves the request
3. **Code Redirect**: Orbitar redirects to your app with an authorization code
4. **Token Exchange**: Your app exchanges the code for access tokens
5. **API Access**: Your app uses the access token to make API requests

### Step 1: Authorization Request

Redirect the user to Orbitar's authorization endpoint:

```
https://orbitar.space/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=REQUESTED_SCOPES&redirect_uri=YOUR_REDIRECT_URI&state=RANDOM_STATE_STRING
```

Parameters:

- `client_id`: Your application's Client ID
- `scope`: Space-separated list of permissions your app needs
- `redirect_uri`: Must match one of the URIs you registered
- `state`: Random string for security validation (see security note below)

**Note**: If you provided an App connection URL, you have two options for this URL:

1. Set it directly to Orbitar's authorization endpoint with the parameters above
   (you would need to hardcode the `state` parameter)
2. Set it to a URL in your app that will then redirect users to Orbitar's authorization endpoint
   (recommended)

The second option is more secure and gives you more control.

**Security Note about State Parameter**: The `state` parameter serves multiple security purposes:

1. **Preventing CSRF attacks**: It ensures the authorization request came from your application
2. **Session binding**: It binds the authorization request to the user's session
3. **Protection against replay attacks**: It prevents authorization codes from being reused

To implement this correctly, your application must:

1. Generate a unique, unpredictable state value for each authorization request
2. Store this value in the user's session or other secure storage
3. Verify that the state returned in the callback exactly matches the stored state
4. Reject the authorization if the state validation fails

### Step 2: User Authorization

The user will see a consent screen showing:

- Your application name and description
- Your username (the developer/creator of the application)
- The permissions your app is requesting
- Buttons to approve or deny

### Step 3: Authorization Code

If the user approves, Orbitar will redirect to your `redirect_uri` with an authorization code:

```
https://your-app.example/callback?code=CODE&state=RANDOM_STATE_STRING
```

This code is temporary and expires quickly.
The state parameter should match the one you sent in the authorization request.

### Step 4: Token Exchange

Your application must exchange this code for access and refresh tokens. You can authenticate using either Basic
Authentication in the header or by including client credentials in the request body.

**Method 1: Using Basic Authentication (recommended)**

```
POST https://api.orbitar.space/api/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic BASE64(CLIENT_ID:CLIENT_SECRET)

grant_type=authorization_code&code=AUTHORIZATION_CODE&nonce=RANDOM_STRING&redirect_uri=YOUR_REDIRECT_URI
```

**Method 2: Including client credentials in request body**

```
POST https://api.orbitar.space/api/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=AUTHORIZATION_CODE&nonce=RANDOM_STRING&redirect_uri=YOUR_REDIRECT_URI&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
```

Parameters:

- `grant_type`: Must be "authorization_code"
- `code`: The authorization code received from the previous step
- `nonce`: Optional random string for additional security
- `redirect_uri`: Must match the URI used in the authorization request
- `client_id`: Your application's Client ID (if using Method 2)
- `client_secret`: Your application's Client Secret (if using Method 2)

The response contains:

```json
{
  "access_token": "ACCESS_TOKEN",
  "refresh_token": "REFRESH_TOKEN",
  "token_type": "Bearer",
  "scope": "GRANTED_SCOPES",
  "expires_in": 1800
}
```

### Step 5: Using Access Tokens

Include the access token in API requests to Orbitar:

```
POST https://api.orbitar.space/api/v1/status
Authorization: Bearer ACCESS_TOKEN
```

**Note**: Make sure the scopes you requested during authorization include access to the endpoints you plan to use. For
example, to access the `/api/v1/status` endpoint, your authorized scopes must include permission for this resource.

### Step 6: Refreshing Tokens

Access tokens expire after a period of time (usually 30 minutes). Use the refresh token to get a new access token. You
can authenticate using either Basic Authentication in the header or by including client credentials in the request body.

**Method 1: Using Basic Authentication (recommended)**

```
POST https://api.orbitar.space/api/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic BASE64(CLIENT_ID:CLIENT_SECRET)

grant_type=refresh_token&refresh_token=REFRESH_TOKEN
```

**Method 2: Including client credentials in request body**

```
POST https://api.orbitar.space/api/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=REFRESH_TOKEN&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
```

If the refresh token has expired, you'll need to initiate a new authorization flow for the user starting from Step 1.

## Scopes

Scopes define what your application can access. Orbitar automatically creates scopes based on API routes. Scopes
follow a hierarchy where more specific permissions are grouped under more general ones.

### Scope Hierarchy

Scopes are built from API routes using the following rules:

1. URL paths are converted to scopes by replacing slashes with colons
2. More general scopes include more specific ones
3. When a general scope is granted, all its sub-scopes are implicitly granted

For example, an API endpoint `/api/v1/user/profile` generates these hierarchical scopes:

- `user` (most general)
- `user:profile` (more specific)

If your application has the `user` scope, it automatically has access to all `user:*` sub-scopes, including
`user:profile`, `user:settings`, etc.

### Examples of Scope Hierarchy

1. **Post management scopes**:
    - `post` (access to all post-related endpoints)
    - `post:create` (create new posts)
    - `post:edit` (edit existing posts)
    - `post:comment` (comment on posts)
    - `post:get` (retrieve posts)

   Requesting just the `post` scope grants access to all post operations.

2. **User-related scopes**:
    - `user` (access to all user endpoints)
    - `user:profile` (view user profiles)
    - `user:save` (save user profile settings)
    - `user:settings` (access user settings)

3. **Other important scopes**:
    - `feed` (access to feed endpoints)
    - `site` (access to site endpoints)
    - `site:subscribe` (subscribe to sites)
    - `vote` (voting capabilities)
    - `notifications` (access user notifications)

### How API Routes Map to Scopes

Here are examples of how API routes map to scope names:

| API Route                | Generated Scopes         |
|--------------------------|--------------------------|
| `/api/v1/status`         | `status`                 |
| `/api/v1/user/profile`   | `user`, `user:profile`   |
| `/api/v1/post/create`    | `post`, `post:create`    |
| `/api/v1/site/subscribe` | `site`, `site:subscribe` |

When requesting scopes, ask for the most specific scope your application needs. The system will
automatically remove redundant scopes. For example, if you request both `user` and `user:profile`, only the more general
`user` scope will be used because it already includes `user:profile` access.

## Security Best Practices

1. **Keep Client Secret secure**: Never expose it in client-side code
2. **Use HTTPS**: Always use secure connections
3. **Validate redirect URIs**: Prevent open redirector attacks
4. **Request minimum scopes**: Only ask for permissions you need
5. **Handle token expiration**: Properly refresh tokens when needed
6. Make sure to pass and validate the `state` parameter during the authorization process

## Troubleshooting

Common issues and solutions:

- **Invalid redirect URI**: Make sure the URI matches exactly what you registered
- **Invalid client credentials**: Check your client ID and secret
- **Invalid scopes**: Make sure requested scopes are valid
- **Expired authorization code**: Codes expire quickly, exchange them immediately
- **Expired access token**: Use refresh token to get a new access token

## Sample Applications

We provide complete sample applications that demonstrate the full OAuth2 flow in different programming languages. These
samples include:

- Authorization code flow
- Token exchange
- API requests with access tokens
- Token refresh
- Embedded app card landing page simulation

### Available Samples

- **Node.js**: A complete Express.js application
- **PHP**: A single-file PHP application

All samples implement the same functionality and follow best practices for OAuth2 implementation.

For detailed instructions and to view the sample code, see
the [oauth2-sample-client](https://github.com/spaceshelter/oauth2-sample-client) repository.

## Further Resources

- [OAuth2 Specification](https://oauth.net/2/)
