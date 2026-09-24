# Entity Types in Orbitar

This document describes the different entity types used throughout the Orbitar project and explains their roles and relationships.

## Overview of Entity Type Layers

Orbitar generally follows a pattern of entity types across different layers of the application:

- **DB Layer**: `*Raw` types
- **Manager/Backend Transport Layer**: `*Info` and `*Entity` types  
- **Frontend Layer**: `*Entity` and `*Info` types

While some entities follow this complete pattern (Posts, Comments, Users), others may skip certain layers for simplicity when appropriate.

## 1. Database Layer (*Raw)

- **Location**: `/backend/src/db/types/`
- **Examples**: `PostRaw`, `CommentRaw`, `UserRaw`
- **Role**: 
  - Direct representation of database tables
  - Match column names in the database (snake_case)
  - Include all database fields without transformation
  - Used primarily by Repository classes for database operations
  - Often include join data (e.g., `PostRawWithUserData` adds user-specific data)

Example from `PostRaw.ts`:
```typescript
export type PostRaw = {
  post_id: number
  site_id: number
  author_id: number
  rating: number
  title: string
  source: string
  html: string
  edit_flag?: number
  comments: number
  created_at: Date
  commented_at: Date
  // ...other fields
}
```

## 2. Manager/Transport Layer (*Entity, *Info)

### Backend Entities (`*Entity`)

- **Location**: `/backend/src/api/types/entities/`
- **Examples**: `PostEntity`, `CommentEntity`
- **Role**:
  - API transport objects for client-server communication
  - Simplified and sanitized versions of Raw types
  - Use camelCase naming convention
  - Include only fields needed by the frontend
  - Field types often adapted for API transport (Dates as strings)

Example from `PostEntity.ts`:
```typescript
export type PostEntity = {
  id: number
  site: string
  author: number
  created: string // Date converted to string for API transport
  title?: string
  content?: string
  rating: number
  comments: number
  newComments: number
  bookmark?: boolean
  watch?: boolean
  canEdit?: boolean
  editFlag?: EditFlag
  vote?: number
  language?: string
}
```

### Backend Info Objects (`*Info`)

- **Location**: `/backend/src/managers/types/`
- **Examples**: `PostInfo`, `CommentInfo`
- **Role**:
  - Internal transport objects between managers and controllers
  - Similar to Entities but may use native types (Date objects instead of strings)
  - Often include additional processing fields not exposed to frontend
  - Act as intermediaries between Raw types and Entity types

Example from `PostInfo.ts`:
```typescript
export type PostInfo = {
  id: number
  site: string
  author: number
  created: Date // Native Date object, not string
  title?: string
  content?: string
  rating: number
  comments: number
  newComments: number
  canEdit?: boolean
  bookmark?: boolean
  watch?: boolean
  vote?: number
  lastReadCommentId?: number
  language?: string
}
```

## 3. Frontend Layer

### Entity Types (`*Entity`)

- **Location**: `/frontend/src/API/`
- **Examples**: `PostEntity` in `PostAPI.ts`
- **Role**:
  - Mirror of backend Entity types
  - Used for direct API communication
  - Often include type definitions for request/response objects

Example from `PostAPI.ts`:
```typescript
export type PostEntity = {
  id: number
  site: string
  author: number
  created: string
  title?: string
  content: string
  rating: number
  comments: number
  newComments: number
  editFlag?: EditFlag
  vote?: number
  language?: string
}
```

### Info Types (`*Info`)

- **Location**: `/frontend/src/Types/`
- **Examples**: `PostInfo`, `CommentInfo`
- **Role**:
  - Enhanced versions of Entity types for frontend use
  - Include more complex object references (e.g., `author: UserBaseInfo` instead of just an ID)
  - Used for rendering in React components
  - May include UI-specific properties

Example from `PostInfo.ts`:
```typescript
export interface PostInfo extends PostLinkInfo {
  id: number
  site: string
  author: UserBaseInfo // Rich object reference instead of just ID
  created: Date
  title?: string
  content: string
  rating: number
  comments: number
  newComments: number
  editFlag?: number
  vote?: number
  watch?: boolean
  bookmark?: boolean
  canEdit?: boolean
  language?: string
}
```

## Data Flow and Transformation

1. **Repository Layer**: Works with *Raw types directly from database
2. **Manager Layer**: Transforms *Raw into *Info objects (e.g., `convertRawPosts` in FeedManager)
3. **Controller Layer**: Transforms *Info into *Entity objects for API response
4. **Frontend API Layer**: Maps *Entity responses to frontend *Entity objects
5. **Frontend Components**: Map *Entity to *Info objects with enriched references

## Simplified Patterns and Exceptions

Not all entities follow the complete pattern. Some entities use simplified approaches:

### Direct Raw to Entity Transformation (Skipping Info Layer)

Some entities bypass the *Info layer and go directly from *Raw to *Entity, especially for simpler entities:

Example - OAuth2Client:
```typescript
// DB Layer
export interface OAuth2ClientRaw {
  id: number
  name: string
  client_id: string
  client_secret_hash: string
  redirect_uris: string
  grants: string
  user_id: number
  // Other fields...
}

// Entity Layer (no Info layer in between)
export type OAuth2ClientEntity = {
  name: string
  clientId: string
  clientSecretHash?: string
  redirectUris: string
  grants: string
  userId: number
  author: UserBaseEntity
  // Other fields...
}
```

### Raw Referencing Entity Types (Skip Direction)

Some newer features like Polls have Raw types that reference Entity types, inverting the usual pattern:

```typescript
// Entity Definition
export interface PollSettingsEntity {
  allow_multiple_choice: boolean
  result_visibility: 'always' | 'after_vote' | 'after_vote_end'
  allow_vote_rescinding: boolean
  vote_access: 'everybody' | 'users_with_full_rights'
}

// Raw Type Referencing Entity Type
export interface PollRaw {
  poll_id: number
  author_id: number
  question: string
  options: string[]
  settings: PollSettingsEntity  // References the Entity type
  // Other fields...
}
```

### Vote Entity Type (Minimal Definition)

Some entities have very minimal definitions with only the essential fields:

```typescript
// DB Layer
export type PostVoteRaw = {
  vote_id: number
  voter_id: number
  post_id: number
  vote: number
  voted_at: Date
}

// Entity Layer - Much simpler
export type VoteListItemEntity = {
  vote: number
  username: string
}
```

## Reasons for Type Separation

1. **Separation of concerns**: Each layer deals with appropriate level of data abstraction
2. **Type safety**: Ensures consistent data structures throughout the application
3. **Data transformation**: Allows appropriate conversion between database and presentation formats
4. **Security**: Ensures sensitive data doesn't leak from the database to the frontend
5. **Performance**: Enables transferring only necessary data between layers (e.g. id instead of full object)
6. **Frontend ergonomics**: Provides rich object references for easier component development
7. **Pragmatic simplification**: Simpler entities may bypass certain layers when the complete pattern would add unnecessary complexity

The project generally follows these patterns across different entity types, with appropriate simplifications where needed to maintain a clean and organized data flow architecture while remaining pragmatic about implementation complexity.