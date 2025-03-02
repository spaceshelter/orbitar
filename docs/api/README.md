# Orbitar API Documentation

> Note: This documentation is based on the OpenAPI 3.0.0 schema and may not be exhaustive. For the most up-to-date API information, consult the [source code](https://github.com/spaceshelter/orbitar) or use your browser's web developer tools (Network tab) to inspect requests, payloads, and responses when using the https://orbitar.space website.

## Table of Contents

- [Introduction](#introduction)
- [Authentication](#authentication)
- [Request Format](#request-format)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Auth](#auth)
  - [Feeds](#feeds)
  - [Posts and comments](#posts-and-comments)
  - [Invites](#invites)
  - [Notifications](#notifications)
  - [OAuth2](#oauth2)
  - [Search](#search)
  - [Sites](#sites)
  - [Status](#status)
  - [User](#user)
  - [Votes](#votes)
- [Response Codes](#response-codes)

## Introduction

This documentation covers the Orbitar API endpoints, their parameters, authentication requirements, and response formats. All API requests should be sent to the base URL: `https://api.orbitar.space/api/v1/`.

## Authentication

Most API endpoints require authentication. There are two ways to provide authentication:

1. [**Session Authentication**](#session-authentication): Send a valid session ID in the `X-Session-Id` header. Session IDs are obtained by signing in through the `/auth/signin` endpoint:

   ```
   X-Session-Id: your_session_id
   ```

2. [**OAuth2 Authentication**](https://github.com/spaceshelter/orbitar/tree/dev/docs/api/oauth2): Send an OAuth2 access token in the `Authorization` header using the Bearer scheme:

   ```
   Authorization: Bearer your_access_token
   ```

   Access tokens are obtained through the [OAuth2 flow](https://github.com/spaceshelter/orbitar/tree/dev/docs/api/oauth2) using the `/oauth2/token` endpoint.

## Request Format

- All requests use HTTP POST
- Request body should be sent as JSON with `Content-Type: application/json` header
- Response format:

  ```json
  {
    "result": "success",
    "payload": {
      // Response data specific to the endpoint
    },
    "sync": "synchronization_timestamp"
  }
  ```
  
  or for errors:
  
  ```json
  {
    "result": "error",
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
  ```

## Rate Limiting

Many endpoints have rate limits. When a rate limit is exceeded, the server will respond with HTTP 429 status code. Rate limits vary by endpoint and may include limits per minute, hour, or day.

## API Endpoints

### Session authentication

#### Sign In
- **POST** `https://api.orbitar.space/api/v1/auth/signin`
- **Description**: Sign in a user
- **Authentication**: Not required
- **Request body**:

  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "user": {
        "id": "number",
        "username": "string",
        "name": "string",
        "gender": "string"
      },
      "session": "string"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"username": "example_user", "password": "password123"}'
  ```

#### Sign Out
- **POST** `https://api.orbitar.space/api/v1/auth/signout`
- **Description**: Sign out current user
- **Authentication**: Required
- **OAuth Scopes**:
  - `auth:signout` - Ability to sign out
  - `auth` - Full access to auth endpoints
- **Request body**: Empty
- **Response**: Empty
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/auth/signout \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token"
  ```

#### Reset Password
- **POST** `https://api.orbitar.space/api/v1/auth/reset-password`
- **Description**: Initiate password reset
- **Authentication**: Not required
- **Request body**:

  ```json
  {
    "email": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "result": "boolean"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/auth/reset-password \
    -H "Content-Type: application/json" \
    -d '{"email": "user@example.com"}'
  ```

#### Set New Password
- **POST** `https://api.orbitar.space/api/v1/auth/new-password`
- **Description**: Set new password after reset
- **Authentication**: Not required
- **Request body**:

  ```json
  {
    "password": "string",
    "code": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "result": "boolean"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/auth/new-password \
    -H "Content-Type: application/json" \
    -d '{"password": "new_password", "code": "reset_code"}'
  ```

#### Check Reset Password Code
- **POST** `https://api.orbitar.space/api/v1/auth/check-reset-password-code`
- **Description**: Validate reset password code
- **Authentication**: Not required
- **Request body**:

  ```json
  {
    "code": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "result": "boolean"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/auth/check-reset-password-code \
    -H "Content-Type: application/json" \
    -d '{"code": "reset_code"}'
  ```

#### Drop Password and Sessions
- **POST** `https://api.orbitar.space/api/v1/auth/drop-password-and-sessions`
- **Description**: Remove password and invalidate all sessions
- **Authentication**: Required
- **OAuth Scopes**:
  - `auth:drop` - Ability to drop password and sessions
  - `auth` - Full access to auth endpoints
- **Request body**: Empty
- **Response**: Empty
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/auth/drop-password-and-sessions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token"
  ```

### Feeds

#### Get Subscriptions Feed
- **POST** `https://api.orbitar.space/api/v1/feed/subscriptions`
- **Description**: Get feed for subscribed sites
- **Authentication**: Required
- **OAuth Scopes**: 
  - `feed:subscriptions` - Access to subscribed feeds specifically
  - `feed` - General feed access
- **Request body**:

  ```json
  {
    "page": "number",
    "perpage": "number",
    "format": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "posts": "array",
      "total": "number",
      "users": "object",
      "sites": "object",
      "sorting": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/feed/subscriptions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"page": 1, "perpage": 20, "format": "html"}'
  ```

#### Get All Feed
- **POST** `https://api.orbitar.space/api/v1/feed/all`
- **Description**: Get feed for all sites
- **Authentication**: Required
- **OAuth Scopes**: 
  - `feed:all` - Access to global feed specifically
  - `feed` - General feed access
- **Request body**:

  ```json
  {
    "page": "number",
    "perpage": "number",
    "format": "string"
  }
  ```

- **Response**: Same as subscriptions feed
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/feed/all \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"page": 1, "perpage": 20, "format": "html"}'
  ```

#### Get Site Feed
- **POST** `https://api.orbitar.space/api/v1/feed/posts`
- **Description**: Get feed for specific site
- **Authentication**: Required
- **OAuth Scopes**: 
  - `feed:posts` - Access to site-specific feeds
  - `feed` - General feed access
- **Request body**:

  ```json
  {
    "site": "string",
    "page": "number",
    "perpage": "number",
    "format": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "posts": "array",
      "total": "number",
      "users": "object",
      "site": "object",
      "sorting": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/feed/posts \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"site": "news", "page": 1, "perpage": 20, "format": "html"}'
  ```

#### Get Watch Feed
- **POST** `https://api.orbitar.space/api/v1/feed/watch`
- **Description**: Get feed for watched posts
- **Authentication**: Required
- **OAuth Scopes**: 
  - `feed:watch` - Access to watched posts feed specifically
  - `feed` - General feed access
- **Request body**:

  ```json
  {
    "filter": "string",
    "page": "number",
    "perpage": "number",
    "format": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "posts": "array",
      "total": "number",
      "users": "object",
      "sites": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/feed/watch \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"filter": "all", "page": 1, "perpage": 20, "format": "html"}'
  ```

#### Save Feed Sorting
- **POST** `https://api.orbitar.space/api/v1/feed/sorting`
- **Description**: Save feed sorting preferences
- **Authentication**: Required
- **OAuth Scopes**: 
  - `feed:sorting` - Ability to change feed sorting specifically
  - `feed` - General feed access
- **Request body**:

  ```json
  {
    "site": "string",
    "feedSorting": "number"
  }
  ```

- **Response**: Empty object
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/feed/sorting \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"site": "news", "feedSorting": 1}'
  ```

### Posts and comments

#### Get Post
- **POST** `https://api.orbitar.space/api/v1/post/get`
- **Description**: Get post by ID
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:get` - Access to read posts specifically
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "id": "number",
    "format": "string",
    "noComments": "boolean"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "post": "object",
      "site": "object",
      "comments": "array",
      "users": "object",
      "anonymousUser": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/get \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 12345, "format": "html", "noComments": false}'
  ```

#### Create Post
- **POST** `https://api.orbitar.space/api/v1/post/create`
- **Description**: Create a new post
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:create` - Ability to create posts specifically
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "site": "string",
    "title": "string",
    "content": "string",
    "format": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "post": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/create \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"site": "news", "title": "New Post", "content": "Post content", "format": "source"}'
  ```

#### Edit Post
- **POST** `https://api.orbitar.space/api/v1/post/edit`
- **Description**: Edit existing post
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:edit` - Ability to edit posts specifically
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "id": "number",
    "title": "string",
    "content": "string",
    "format": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "post": "object",
      "users": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/edit \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 12345, "title": "Updated Title", "content": "Updated content", "format": "source"}'
  ```

#### Add Comment
- **POST** `https://api.orbitar.space/api/v1/post/comment`
- **Description**: Add comment to post
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:comment` - Ability to comment on posts specifically
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "post_id": "number",
    "comment_id": "number",
    "content": "string",
    "format": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "comment": "object",
      "users": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/comment \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"post_id": 12345, "content": "Comment content", "format": "source"}'
  ```

#### Preview Content
- **POST** `https://api.orbitar.space/api/v1/post/preview`
- **Description**: Preview content parsing
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:preview` - Ability to preview content
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "content": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "content": "string"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/preview \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"content": "Content to preview"}'
  ```

#### Mark Post as Read
- **POST** `https://api.orbitar.space/api/v1/post/read`
- **Description**: Mark post as read
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:read` - Ability to mark posts as read
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "post_id": "number",
    "comments": "number",
    "last_comment_id": "number"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "notifications": "number",
      "watch": "boolean"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/read \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"post_id": 12345, "comments": 10, "last_comment_id": 5678}'
  ```

#### Bookmark Post
- **POST** `https://api.orbitar.space/api/v1/post/bookmark`
- **Description**: Bookmark/unbookmark post
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:bookmark` - Ability to bookmark posts
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "post_id": "number",
    "bookmark": "boolean"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "bookmark": "boolean"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/bookmark \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"post_id": 12345, "bookmark": true}'
  ```

#### Watch Post
- **POST** `https://api.orbitar.space/api/v1/post/watch`
- **Description**: Watch/unwatch post
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:watch` - Ability to watch posts
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "post_id": "number",
    "watch": "boolean"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "watch": "boolean"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/watch \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"post_id": 12345, "watch": true}'
  ```

#### Translate Post
- **POST** `https://api.orbitar.space/api/v1/post/translate`
- **Description**: AI-related actions with content
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:translate` - Ability to translate posts
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "id": "number",
    "type": "string",
    "mode": "string"
  }
  ```

- **Response**: Processed content
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/translate \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 12345, "type": "post", "mode": "altTranslate"}'
  ```

#### Get Comment
- **POST** `https://api.orbitar.space/api/v1/post/get-comment`
- **Description**: Get a specific comment
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:get-comment` - Access to read comments specifically
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "id": "number",
    "format": "string"
  }
  ```

- **Response**: Comment details
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/get-comment \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 5678, "format": "html"}'
  ```

#### Edit Comment
- **POST** `https://api.orbitar.space/api/v1/post/edit-comment`
- **Description**: Edit an existing comment
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:edit-comment` - Ability to edit comments
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "id": "number",
    "content": "string",
    "format": "string"
  }
  ```

- **Response**: Updated comment
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/edit-comment \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 5678, "content": "Updated comment", "format": "source"}'
  ```

#### Get Edit History
- **POST** `https://api.orbitar.space/api/v1/post/history`
- **Description**: Get edit history for post/comment
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:history` - Access to post editing history
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "id": "number",
    "type": "string",
    "format": "string"
  }
  ```

- **Response**: Edit history
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/history \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 12345, "type": "post", "format": "html"}'
  ```

#### Get Public Key
- **POST** `https://api.orbitar.space/api/v1/post/get-public-key`
- **Description**: Get public key of a post author
- **Authentication**: Required
- **OAuth Scopes**: 
  - `post:get-public-key` - Access to post author's public key
  - `post` - Full access to posts
- **Request body**:

  ```json
  {
    "username": "string"
  }
  ```

- **Response**: Public key information
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/post/get-public-key \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"username": "example_user"}'
  ```

### Invites

#### Check Invite
- **POST** `https://api.orbitar.space/api/v1/invite/check`
- **Description**: Verifies if an invite code is valid
- **Authentication**: Required for OAuth
- **OAuth Scopes**: 
  - `invite:check` - Ability to check invites
  - `invite` - Full access to invites
- **Request body**:

  ```json
  {
    "code": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "invite": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/invite/check \
    -H "Content-Type: application/json" \
    -d '{"code": "ABC123"}'
  ```

#### Use Invite
- **POST** `https://api.orbitar.space/api/v1/invite/use`
- **Description**: Uses an invite to register a new user
- **Authentication**: Not required
- **OAuth Scopes**: 
  - `invite:use` - Ability to use invites
  - `invite` - Full access to invites
- **Request body**:

  ```json
  {
    "code": "string",
    "username": "string",
    "name": "string",
    "email": "string",
    "gender": "number",
    "password": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "user": "object",
      "session": "string"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/invite/use \
    -H "Content-Type: application/json" \
    -d '{"code": "ABC123", "username": "new_user", "name": "New User", "email": "user@example.com", "gender": 1, "password": "password123"}'
  ```

#### List Invites
- **POST** `https://api.orbitar.space/api/v1/invite/list`
- **Description**: Lists invites for a user
- **Authentication**: Required
- **OAuth Scopes**: 
  - `invite:list` - Ability to list invites
  - `invite` - Full access to invites
- **Request body**:

  ```json
  {
    "username": "string"
  }
  ```

- **Response**: List of invites
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/invite/list \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"username": "example_user"}'
  ```

#### Regenerate Invite
- **POST** `https://api.orbitar.space/api/v1/invite/regenerate`
- **Description**: Regenerates an invite code
- **Authentication**: Required
- **OAuth Scopes**: 
  - `invite:regenerate` - Ability to regenerate invites
  - `invite` - Full access to invites
- **Request body**:

  ```json
  {
    "code": "string"
  }
  ```

- **Response**: New invite code
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/invite/regenerate \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"code": "ABC123"}'
  ```

#### Create Invite
- **POST** `https://api.orbitar.space/api/v1/invite/create`
- **Description**: Creates a new invite
- **Authentication**: Required
- **OAuth Scopes**: 
  - `invite:create` - Ability to create invites
  - `invite` - Full access to invites
- **Request body**:

  ```json
  {
    "reason": "string"
  }
  ```

- **Response**: New invite details
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/invite/create \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"reason": "Invited for project collaboration"}'
  ```

#### Delete Invite
- **POST** `https://api.orbitar.space/api/v1/invite/delete`
- **Description**: Deletes an invite
- **Authentication**: Required
- **OAuth Scopes**: 
  - `invite:delete` - Ability to delete invites
  - `invite` - Full access to invites
- **Request body**:

  ```json
  {
    "code": "string"
  }
  ```

- **Response**: Operation result
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/invite/delete \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"code": "ABC123"}'
  ```

#### Edit Invite
- **POST** `https://api.orbitar.space/api/v1/invite/edit`
- **Description**: Edits an invite reason
- **Authentication**: Required
- **OAuth Scopes**: 
  - `invite:edit` - Ability to edit invites
  - `invite` - Full access to invites
- **Request body**:

  ```json
  {
    "code": "string",
    "reason": "string"
  }
  ```

- **Response**: Updated invite
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/invite/edit \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"code": "ABC123", "reason": "Updated reason"}'
  ```

### Notifications

#### List Notifications
- **POST** `https://api.orbitar.space/api/v1/notifications/list`
- **Description**: Lists user notifications
- **Authentication**: Required
- **OAuth Scopes**: 
  - `notifications:list` - Ability to list notifications
  - `notifications` - Full access to notifications
- **Request body**:

  ```json
  {
    "webPushAuth": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "notifications": "array",
      "users": "object",
      "posts": "object",
      "comments": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/notifications/list \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token"
  ```

#### Mark Notification as Read
- **POST** `https://api.orbitar.space/api/v1/notifications/read`
- **Description**: Marks a notification as read
- **Authentication**: Required
- **OAuth Scopes**: 
  - `notifications:read` - Ability to mark notifications as read
  - `notifications` - Full access to notifications
- **Request body**:

  ```json
  {
    "id": "number"
  }
  ```

- **Response**: Empty object
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/notifications/read \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 12345}'
  ```

#### Hide Notification
- **POST** `https://api.orbitar.space/api/v1/notifications/hide`
- **Description**: Hides a notification
- **Authentication**: Required
- **OAuth Scopes**: 
  - `notifications:hide` - Ability to hide notifications
  - `notifications` - Full access to notifications
- **Request body**:

  ```json
  {
    "id": "number"
  }
  ```

- **Response**: Empty object
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/notifications/hide \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"id": 12345}'
  ```

#### Mark All Notifications as Read
- **POST** `https://api.orbitar.space/api/v1/notifications/read/all`
- **Description**: Marks all notifications as read
- **Authentication**: Required
- **OAuth Scopes**: 
  - `notifications:read:all` - Ability to mark all notifications as read
  - `notifications` - Full access to notifications
- **Request body**: Empty
- **Response**: Empty object
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/notifications/read/all \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token"
  ```

#### Hide All Notifications
- **POST** `https://api.orbitar.space/api/v1/notifications/hide/all`
- **Description**: Hides all notifications
- **Authentication**: Required
- **OAuth Scopes**: 
  - `notifications:hide:all` - Ability to hide all notifications
  - `notifications` - Full access to notifications
- **Request body**:

  ```json
  {
    "readOnly": "boolean"
  }
  ```

- **Response**: Empty object
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/notifications/hide/all \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"readOnly": true}'
  ```

#### Subscribe to Push Notifications
- **POST** `https://api.orbitar.space/api/v1/notifications/subscribe`
- **Description**: Subscribes to push notifications
- **Authentication**: Required
- **OAuth Scopes**: 
  - `notifications:subscribe` - Ability to subscribe to notifications
  - `notifications` - Full access to notifications
- **Request body**:

  ```json
  {
    "subscription": "object"
  }
  ```

- **Response**: Empty object
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/notifications/subscribe \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"subscription": {"endpoint": "https://example.com", "keys": {"p256dh": "key", "auth": "auth"}}}'
  ```

### OAuth2

#### List Client Apps
- **POST** `https://api.orbitar.space/api/v1/oauth2/clients`
- **Description**: Lists client apps created by user
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:clients` - Ability to list OAuth2 clients
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**: Empty
- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "clients": "array"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/clients \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token"
  ```

#### Get Client App
- **POST** `https://api.orbitar.space/api/v1/oauth2/client`
- **Description**: Gets client app by client_id
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:client` - Ability to get OAuth2 client details
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "client_id": "string"
  }
  ```

- **Response**: Client details
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/client \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"client_id": "client123"}'
  ```

#### Get Multiple Client Apps
- **POST** `https://api.orbitar.space/api/v1/oauth2/clients-batch`
- **Description**: Gets multiple client apps by client_ids
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:clients-batch` - Ability to batch get OAuth2 clients
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "client_ids": ["string"]
  }
  ```

- **Response**: Map of clients
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/clients-batch \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"client_ids": ["client123", "client456"]}'
  ```

#### Register Client App
- **POST** `https://api.orbitar.space/api/v1/oauth2/client/register`
- **Description**: Registers new OAuth2 client app
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:client:register` - Ability to register OAuth2 clients
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "name": "string",
    "description": "string",
    "redirectUris": "string",
    "logoUrl": "string",
    "initialAuthorizationUrl": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "client": "object",
      "client_secret": "string"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/client/register \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"name": "My App", "description": "Description", "redirectUris": "https://myapp.com/callback"}'
  ```

#### Edit Client App
- **POST** `https://api.orbitar.space/api/v1/oauth2/client/edit`
- **Description**: Edits OAuth2 client app
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:client:edit` - Ability to edit OAuth2 clients
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "clientId": "string",
    "description": "string",
    "redirectUris": "string",
    "initialAuthorizationUrl": "string"
  }
  ```

- **Response**: Updated client
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/client/edit \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"clientId": "client123", "description": "Updated description", "redirectUris": "https://myapp.com/callback"}'
  ```

#### Regenerate Client Secret
- **POST** `https://api.orbitar.space/api/v1/oauth2/client/regenerate-secret`
- **Description**: Regenerates client secret
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:client:regenerate-secret` - Ability to regenerate OAuth2 client secrets
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "client_id": "string"
  }
  ```

- **Response**: New secret
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/client/regenerate-secret \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"client_id": "client123"}'
  ```

#### Update Client Logo
- **POST** `https://api.orbitar.space/api/v1/oauth2/client/update-logo`
- **Description**: Updates client logo URL
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:client:update-logo` - Ability to update OAuth2 client logos
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "client_id": "string",
    "url": "string"
  }
  ```

- **Response**: Empty object
- **Notes**: The URL must be from the orbitar.media domain
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/client/update-logo \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"client_id": "client123", "url": "https://orbitar.media/images/logo.png"}'
  ```

#### Delete Client App
- **POST** `https://api.orbitar.space/api/v1/oauth2/client/delete`
- **Description**: Deletes OAuth2 client app
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:client:delete` - Ability to delete OAuth2 clients
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "client_id": "string"
  }
  ```

- **Response**: Empty object
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/client/delete \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"client_id": "client123"}'
  ```

#### Verify OAuth2 Scopes
- **POST** `https://api.orbitar.space/api/v1/oauth2/verify-scopes`
- **Description**: Verifies and explains OAuth2 scopes
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:verify-scopes` - Ability to verify OAuth2 scopes
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "scopes": "string"
  }
  ```

- **Response**: Scope descriptions
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/verify-scopes \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"scopes": "status feed:subscriptions"}'
  ```

#### OAuth2 Authorization
- **POST** `https://api.orbitar.space/api/v1/oauth2/authorize`
- **Description**: OAuth2 authorization endpoint
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:authorize` - Ability to authorize OAuth2 clients
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**: Standard OAuth2 parameters
- **Response**: Authorization code
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/authorize \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"client_id": "client123", "response_type": "code", "redirect_uri": "https://example.com/callback", "scope": "status feed:subscriptions"}'
  ```

#### Revoke Authorization
- **POST** `https://api.orbitar.space/api/v1/oauth2/unauthorize`
- **Description**: Revokes authorization for client
- **Authentication**: Required
- **OAuth Scopes**:
  - `oauth2:unauthorize` - Ability to revoke OAuth2 authorizations
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**:

  ```json
  {
    "client_id": "string"
  }
  ```

- **Response**: Updated client
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/unauthorize \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"client_id": "client123"}'
  ```

#### OAuth2 Token
- **POST** `https://api.orbitar.space/api/v1/oauth2/token`
- **Description**: OAuth2 token endpoint
- **Authentication**: Client authentication
- **OAuth Scopes**:
  - `oauth2:token` - Ability to obtain OAuth2 tokens
  - `oauth2` - Full access to OAuth2 endpoints
- **Request body**: Standard OAuth2 token request
- **Response**: Access token
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/oauth2/token \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic base64(client_id:client_secret)" \
    -d '{"grant_type": "authorization_code", "code": "auth_code", "redirect_uri": "https://example.com/callback"}'
  ```

### Search

#### Search
- **POST** `https://api.orbitar.space/api/v1/search`
- **Description**: Searches for posts and comments
- **Authentication**: Required
- **OAuth Scopes**:
  - `search` - Ability to search posts and comments
- **Request body**:

  ```json
  {
    "term": "string",
    "scope": "string",
    "author": "string",
    "response_to": "string",
    "site": "string",
    "created_at_from": "number",
    "created_at_to": "number",
    "rating_from": "number",
    "rating_to": "number",
    "search_by_date": "boolean",
    "search_direction": "string",
    "page": "number",
    "perpage": "number"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "posts": "array",
      "comments": "array",
      "total": "number",
      "users": "object",
      "sites": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"term": "search term", "scope": "post", "page": 1, "perpage": 20}'
  ```

### Sites

#### Get Site Info
- **POST** `https://api.orbitar.space/api/v1/site/get`
- **Description**: Gets info about a site
- **Authentication**: Required
- **OAuth Scopes**:
  - `site:get` - Access to site information
  - `site` - Full access to site endpoints
- **Request body**:

  ```json
  {
    "site": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "site": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/site/get \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"site": "news"}'
  ```

#### Subscribe to Site
- **POST** `https://api.orbitar.space/api/v1/site/subscribe`
- **Description**: Subscribes to a site
- **Authentication**: Required
- **OAuth Scopes**:
  - `site:subscribe` - Ability to subscribe to sites
  - `site` - Full access to site endpoints
- **Request body**:

  ```json
  {
    "site": "string",
    "main": "boolean",
    "bookmarks": "boolean"
  }
  ```

- **Response**: Subscription status
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/site/subscribe \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"site": "news", "main": true, "bookmarks": false}'
  ```

#### Get Site Subscriptions
- **POST** `https://api.orbitar.space/api/v1/site/subscriptions`
- **Description**: Gets user's site subscriptions
- **Authentication**: Required
- **OAuth Scopes**:
  - `site:subscriptions` - Access to site subscription list
  - `site` - Full access to site endpoints
- **Request body**: Empty
- **Response**: Subscriptions list
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/site/subscriptions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token"
  ```

#### List Sites
- **POST** `https://api.orbitar.space/api/v1/site/list`
- **Description**: Lists all sites
- **Authentication**: Required
- **OAuth Scopes**:
  - `site:list` - Access to list of all sites
  - `site` - Full access to site endpoints
- **Request body**:

  ```json
  {
    "page": "number",
    "perpage": "number"
  }
  ```

- **Response**: Sites list
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/site/list \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"page": 1, "perpage": 50}'
  ```

#### Create Site
- **POST** `https://api.orbitar.space/api/v1/site/create`
- **Description**: Creates a new site
- **Authentication**: Required
- **OAuth Scopes**:
  - `site:create` - Ability to create sites
  - `site` - Full access to site endpoints
- **Request body**:

  ```json
  {
    "site": "string",
    "name": "string"
  }
  ```

- **Response**: Site details
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/site/create \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"site": "tech", "name": "Technology"}'
  ```

### Status

#### Get Status
- **POST** `https://api.orbitar.space/api/v1/status`
- **Description**: Gets user status and stats
- **Authentication**: Required
- **OAuth Scopes**:
  - `status` - Access to user status information
- **Request body**: Empty
- **Response**: User info and stats
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/status \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token"
  ```

### User

#### Get User Profile
- **POST** `https://api.orbitar.space/api/v1/user/profile`
- **Description**: Gets user profile info
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:profile` - Access to user profile information
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "username": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "user": "object",
      "stats": "object",
      "isLimited": "boolean"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/profile \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"username": "example_user"}'
  ```

#### Get User Posts
- **POST** `https://api.orbitar.space/api/v1/user/posts`
- **Description**: Gets user's posts
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:posts` - Access to user's posts
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "username": "string",
    "page": "number",
    "perpage": "number",
    "format": "string"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "posts": "array",
      "total": "number",
      "users": "object",
      "sites": "object"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/posts \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"username": "example_user", "page": 1, "perpage": 20, "format": "html"}'
  ```

#### Get User Comments
- **POST** `https://api.orbitar.space/api/v1/user/comments`
- **Description**: Gets user's comments
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:comments` - Access to user's comments
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "username": "string",
    "page": "number",
    "perpage": "number",
    "format": "string"
  }
  ```

- **Response**: Comments list
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/comments \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"username": "example_user", "page": 1, "perpage": 20, "format": "html"}'
  ```

#### Get User Karma
- **POST** `https://api.orbitar.space/api/v1/user/karma`
- **Description**: Gets user's karma details
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:karma` - Access to user's karma information
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "username": "string"
  }
  ```

- **Response**: Karma breakdown
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/karma \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"username": "example_user"}'
  ```

#### Save User Bio
- **POST** `https://api.orbitar.space/api/v1/user/savebio`
- **Description**: Updates user bio
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:savebio` - Ability to update user bio
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "bio": "string"
  }
  ```

- **Response**: Updated bio
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/savebio \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"bio": "My new bio"}'
  ```

#### Save User Name
- **POST** `https://api.orbitar.space/api/v1/user/savename`
- **Description**: Updates user name
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:savename` - Ability to update user name
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "name": "string"
  }
  ```

- **Response**: Updated name
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/savename \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"name": "New Display Name"}'
  ```

#### Save User Public Key
- **POST** `https://api.orbitar.space/api/v1/user/save-public-key`
- **Description**: Saves user's public key
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:save-public-key` - Ability to save user's public key
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "publicKey": "string"
  }
  ```

- **Response**: Saved key
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/save-public-key \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"publicKey": "public_key_data"}'
  ```

#### Suggest Username
- **POST** `https://api.orbitar.space/api/v1/user/suggest-username`
- **Description**: Suggests usernames
- **Authentication**: Required
- **OAuth Scopes**:
  - `user:suggest-username` - Ability to get username suggestions
  - `user` - Full access to user endpoints
- **Request body**:

  ```json
  {
    "prefix": "string"
  }
  ```

- **Response**: Username suggestions
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/user/suggest-username \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"prefix": "john"}'
  ```

### Votes

#### Set Vote
- **POST** `https://api.orbitar.space/api/v1/vote/set`
- **Description**: Sets a vote on post, comment, or user
- **Authentication**: Required
- **OAuth Scopes**:
  - `vote:set` - Ability to set votes
  - `vote` - Full access to vote endpoints
- **Request body**:

  ```json
  {
    "type": "string",
    "id": "number",
    "vote": "number"
  }
  ```

- **Response**:

  ```json
  {
    "result": "success",
    "payload": {
      "rating": "number"
    }
  }
  ```

- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/vote/set \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"type": "post", "id": 12345, "vote": 1}'
  ```

#### List Votes
- **POST** `https://api.orbitar.space/api/v1/vote/list`
- **Description**: Lists votes for a post, comment, or user
- **Authentication**: Required
- **OAuth Scopes**:
  - `vote:list` - Ability to list votes
  - `vote` - Full access to vote endpoints
- **Request body**:

  ```json
  {
    "type": "string",
    "id": "number"
  }
  ```

- **Response**: Votes list
- **Example**:

  ```bash
  curl -X POST https://api.orbitar.space/api/v1/vote/list \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer your_access_token" \
    -d '{"type": "post", "id": 12345}'
  ```

## Response Codes

Common error codes returned by the API:

- `RATE_LIMIT_EXCEEDED`: Request rate limit exceeded
- `INVALID_CREDENTIALS`: Invalid username or password
- `ACCESS_DENIED`: User doesn't have permission for this action
- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Requested resource not found
- `SERVER_ERROR`: Internal server error

HTTP Status codes:
- `200`: Successful operation
- `401`: Unauthorized
- `403`: Forbidden
- `429`: Rate limit exceeded
- `500`: Internal Server Error