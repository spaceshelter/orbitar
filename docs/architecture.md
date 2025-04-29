# Orbitar Architecture

Orbitar is a social network/forum platform with multiple components:

- **Frontend**: React application (TypeScript)
- **Backend**: Node.js Express application (TypeScript) 
- **Search**: Elasticsearch service
- **Feed**: Rust service for feed processing
- **Media**: Service for handling media uploads/storage
- **Database**: MySQL (with migrations)
- **Cache**: Redis

## Key Components & Features

### Frontend

- Uses React with TypeScript and CSS modules
- MobX for state management through AppState
- React Router for navigation
- Component-based architecture with a focus on reusability

### Backend

- Express.js API endpoints
- Authentication & authorization systems
- Notification management
- OAuth2 implementation
- Content parsing and processing

### E2E Testing

- Cypress-based end-to-end testing framework
- Tests cover critical user flows and functionality
- Separate test environment with its own configuration
- CI/CD integration for automated testing
- Test data management through environment variables

### Key Concepts

- **Sites**: Sub-communities within the platform
- **Posts**: Main content units
- **Comments**: Nested discussion on posts
- **Users**: User profiles with karma, invites, etc.
- **OAuth2**: External application integration

## Implementation Details


### Authentication Flow

- User authentication stored in session
- OAuth2 flow implemented for external applications
- Check user restrictions before actions

### Content Parsing

- Custom parser in `TheParser.ts` handles content formatting
- Watch for parser version updates that might affect content rendering

### Routing

- Uses react-router-dom with nested routes
- Site-specific routes use a prefix pattern: `/s/:site/...`

### Style System

- CSS Modules are used for component styling
- Global variables for theming in `src/theme.ts`
- Light/dark mode support via CSS variables

### State Management

- AppState is the central state store (using MobX)
- Accessed via `useAppState()` hook
- Modal state and user data are stored here

## Common Tasks

### Adding New Features

1. Identify relevant components/services
2. Check existing patterns in similar components
3. Implement backend APIs if needed
4. Add frontend components using existing patterns
5. Update API interfaces in Types directory

### Fixing UI Issues

1. Check component and CSS module files
2. Examine event handlers for side effects (like scrolling)
3. Verify AppState interactions

### Common Commands

```bash
# Frontend development
cd frontend
npm run dev

# Backend development
cd backend
npm run dev

# Run tests
npm test

# Database migrations
cd backend
node migrations.js

# e2e testing with Cypress
cd e2e
npm run test:e2e
```

## Common File Locations

- React components: `/frontend/src/Components/`
- API services: `/frontend/src/API/`
- Types: `/frontend/src/Types/`
- Backend controllers: `/backend/src/api/`
- Backend managers: `/backend/src/managers/`
- Database migrations: `/backend/migrations/`
- Global styles: `/frontend/src/index.scss`
- E2E tests: `/e2e/cypress/e2e/`