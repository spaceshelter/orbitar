# API documentation

## Authentication Methods

The API supports three methods of authentication, depending on the context and type of request:

### 1. Session ID Authentication
Used primarily for user-specific operations made with UI where a session has been established through the sign-in endpoints.

- **Header**: `X-Session-Id`
- **Value**: The session ID value obtained through the sign-in endpoints.

### 2. Bearer Token Authentication
Utilized for operations that support OAuth2 access tokens.

- **Header**: `Authorization`
- **Value**: `Bearer <access-token>`

### 3. Basic Authentication
Used exclusively for generating new access tokens by providing the client ID and client secret.

- **Header**: `Authorization`
- **Value**: `Basic base64_encode(<client_id>. ':' . hash('sha256', <client_secret>)`

This method also requires `refresh_token` value in the request body

## API Endpoints

* [OAuth2 API](./oauth2.md)
* Session Auth API &lt;TBD>
* Feed API &lt;TBD>
* Invite API API &lt;TBD>
* Notifications API &lt;TBD>
* Notifications API &lt;TBD>
* Post API &lt;TBD>
* Search API &lt;TBD>
* Site API &lt;TBD>
* Status API &lt;TBD>
* User API &lt;TBD>
* Vote API &lt;TBD>
