# OAuth2 API Endpoints

## 1. Register OAuth2 Client

**POST** `/oauth2/client/register`

Registers a new OAuth2 client.

### Request: [`OAuth2RegisterRequest`](#OAuth2RegisterRequest)
- `name` (string, required, max: 32): The name of the client.
- `description` (string, required, max: 255): A description of the client.
- `logoUrl` (string, optional, max: 255): URL to the client's logo.
- `initialAuthorizationUrl` (string, optional, max: 255): Initial authorization URL.
- `redirectUrls` (string, required, max: 255): Comma-separated list of redirect URLs.
- `isPublic` (boolean, required): Whether the client is public.

### Response: [`OAuth2RegisterResponse`](#OAuth2RegisterResponse)
- `client` (`[`OAuth2ClientEntity`](#OAuth2ClientEntity)`): The registered client entity.

---

## 2. List OAuth2 Clients

**POST** `/oauth2/clients`

Lists all OAuth2 clients that should be visible for this user: public clients, authorized (installed) clients and own clients

### Request: [`OAuth2ClientsListRequest`](#OAuth2ClientsListRequest)
- No parameters.

### Response: [`OAuth2ClientsListResponse`](#OAuth2ClientsListResponse)
- `clients` (Array of `[`OAuth2ClientEntity`](#OAuth2ClientEntity)`): List of client entities.

---

## 3. Get OAuth2 Client by Client ID

**POST** `/oauth2/client`

Retrieves an OAuth2 client by its client ID (not numeric id).

### Request: [`OAuth2ClientRequest`](#OAuth2ClientRequest)
- `clientId` (string or number, required): The client ID.

### Response: [`OAuth2ClientResponse`](#OAuth2ClientResponse)
- `client` (`[`OAuth2ClientEntity`](#OAuth2ClientEntity)`): The requested client entity.

---

## 4. Authorize OAuth2 Client

**POST** `/oauth2/authorize`

Generates an authorization code for an OAuth2 client.

### Request: [`OAuth2AuthorizeRequest`](#OAuth2AuthorizeRequest)
- `clientId` (string, required, max: 255): The client ID.
- `scope` (string, required, max: 255): The requested scope.
- `redirectUrl` (string, required, max: 255): The redirect URL.

### Response: [`OAuth2AuthorizeResponse`](#OAuth2AuthorizeResponse)
- `authorizationCode` (string): The generated authorization code.

---

## 5. Generate OAuth2 Token

**POST** `/oauth2/token`

Generates an OAuth2 token.

Parameters are different when token is generated using authorization code or using refresh token grant type.

For `refresh_token` grant type (when you need to get new access token using refresh token) `client_id` and `client_secret` are sent in the HTTP request header `Authorization` which is built like this: 

```
Authorization: Basic base64_encode(<client_id>. ':' . hash('sha256', <client_secret>)
```

When making API requests with access token, `Authorization` header is built like this: 

```
Authorization: Bearer <access_token>
```


### Request: [`OAuth2TokenRequest`](#OAuth2TokenRequest)
- `client_id` (string, required when `grant_type` is `authorization_code`, max: 255): The client ID.
- `client_secret` (string, required when `grant_type` is `authorization_code`, max: 255): The client secret.
- `grant_type` (string, required): The grant type (`authorization_code` or `refresh_token`).
- `code` (string, required when `grant_type` is `authorization_code`, max: 255): The authorization code.
- `nonce` (string, required when `grant_type` is `authorization_code`, max: 255): A nonce value.
- `redirect_url` (string, required when `grant_type` is `authorization_code`, max: 255): The redirect URL.
- `refresh_token` (string, required when `grant_type` is `authorization_code`, max: 255): The refresh token.

### Response: [`OAuth2TokenResponse`](#OAuth2TokenResponse)
- `token` ([`OAuth2Token`](#OAuth2Token)): The generated OAuth2 token.

---

## Regenerate Secret
**POST** `/oauth2/client/regenerate-secret`

Regenerates the secret for an OAuth2 client.

### Request: [`OAuth2ClientManageRequest`](#OAuth2ClientManageRequest)
- `id` (number, required): The ID of the client whose secret is to be regenerated.

### Response: [`OAuth2ClientRegenerateSecretResponse`](#OAuth2ClientRegenerateSecretResponse)
- `newSecret` (string): The new client secret.

---

## Update Logo URL
**POST** `/oauth2/client/update-logo`

Updates the logo URL for an OAuth2 client.

### Request: [`OAuth2ClientUpdateLogoUrlRequest`](#OAuth2ClientUpdateLogoUrlRequest)
- `id` (number, required): The ID of the client.
- `url` (string, required): The new URL for the client's logo.

### Response: [`Record<string, never>`](#Record<string, never>)
- No additional data returned.

---

## Delete Client
**POST** `/oauth2/client/delete`

Deletes an OAuth2 client and revokes all its tokens.

### Request: [`OAuth2ClientManageRequest`](#OAuth2ClientManageRequest)
- `id` (number, required): The ID of the client to be deleted.

### Response: [`Record<string, never>`](#Record<string, never>)
- No additional data returned.

---

## Change Client Visibility
**POST** `/oauth2/client/change-visibility`

Changes the visibility of an OAuth2 client.

### Request: [`OAuth2ClientManageRequest`](#OAuth2ClientManageRequest)
- `id` (number, required): The ID of the client whose visibility is to be changed.

### Response: [`Record<string, never>`](#Record<string, never>)
- No additional data returned.

- **Change Client Visibility**: POST `/oauth2/client/change-visibility`
- **Unauthorize Client**: POST `/oauth2/unauthorize`

---

## Unauthorize Client
**POST** `/oauth2/unauthorize`

Revokes the authorization for an OAuth2 client.

### Request: [`OAuth2ClientManageRequest`](#OAuth2ClientManageRequest)
- `id` (number, required): The ID of the client to be unauthorized.

### Response: [`Record<string, never>`](#Record<string, never>)
- No additional data returned.

## Data Types

### OAuth2ClientEntity
Represents an OAuth2 client entity with the following properties:

- `id` (number): The unique identifier of the client.
- `name` (string): The name of the client.
- `description` (string): A description of the client.
- `clientId` (string): The client ID.
- `clientSecretHash` (string, optional): The hashed client secret.
- `clientSecretOriginal` (string, optional): The original client secret.
- `initialAuthorizationUrl` (string, optional): Initial authorization URL.
- `logoUrl` (string, optional): URL to the client's logo.
- `redirectUrls` (string): Comma-separated list of redirect URLs.
- `grants` (string): The type of grants allowed for the client.
- `userId` (number): The user ID of the client's owner.
- `author` (`UserInfo`): Information about the user who owns the client.
- `isPublic` (boolean): Indicates whether the client is public.
- `isAuthorized` (boolean, optional): Indicates whether the client is authorized.
- `isMy` (boolean, optional): Indicates whether the client belongs to the authenticated user.

### OAuth2Token
Represents an OAuth2 token with the following properties:

- `access_token` (string): The token that can be sent to a server to access protected resources.
- `expires_in` (number): The number of seconds until the token expires.
- `token_type` ('Bearer'): The type of token, typically "Bearer".
- `refresh_token` (string, optional): A token that can be used to obtain a new access token.
- `scope` (string): The scope of access granted by the token.



## Request/Response Data Types


### OAuth2RegisterRequest
Represents a request to register a new OAuth2 client, with the following properties:
- `name` (string): The name of the client.
- `description` (string): A description of the client.
- `logoUrl` (string, optional): URL to the client's logo.
- `initialAuthorizationUrl` (string, optional): Initial authorization URL.
- `redirectUrls` (string): Comma-separated list of redirect URLs.
- `isPublic` (boolean): Whether the client is public.

### OAuth2RegisterResponse
Represents the response for a client registration request:
- `client` (`OAuth2ClientEntity`): The registered client entity.

### OAuth2ClientRequest
Represents a request to retrieve an OAuth2 client:
- `clientId` (string): The client ID.

### OAuth2ClientManageRequest
Represents a request to manage an OAuth2 client (e.g., delete, update):
- `id` (number): The ID of the client.

### OAuth2ClientResponse
Represents the response for a client retrieval request:
- `client` (`OAuth2ClientEntity`): The requested client entity.

### OAuth2ClientsListRequest
Represents a request to list all OAuth2 clients:
- No parameters.

### OAuth2ClientsListResponse
Represents the response for a client list request:
- `clients` (Array of `OAuth2ClientEntity`): List of client entities.

### OAuth2AuthorizeRequest
Represents a request to authorize an OAuth2 client:
- `clientId` (string): The client ID.
- `scope` (string): The requested scope.
- `redirectUrl` (string): The redirect URL.

### OAuth2AuthorizeResponse
Represents the response for an authorization request:
- `authorizationCode` (string): The generated authorization code.

### OAuth2TokenRequest
Represents a request to generate an OAuth2 token:
- `client_id` (string): The client ID.
- `client_secret` (string): The client secret.
- `grant_type` (string): The grant type.
- `redirect_url` (string, optional): The redirect URL.
- `code` (string, optional): The authorization code.
- `nonce` (string, optional): A nonce value.
- `refresh_token` (string, optional): The refresh token.

### OAuth2TokenResponse
Represents the response for a token generation request:
- `token` ([`OAuth2Token`](#OAuth2Token)): The generated OAuth2 token.

### OAuth2ClientRegenerateSecretResponse
Represents the response for a client secret regeneration request:
- `newSecret` (string): The new client secret.

### OAuth2ClientUpdateLogoUrlRequest
Represents a request to update a client's logo URL:
- `id` (number): The ID of the client.
- `url` (string): The new URL for the client's logo.
