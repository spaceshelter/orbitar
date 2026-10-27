# AI Agent Guide

> Reference guide for AI coding assistants working on the Orbitar project

## Project Overview

**Orbitar** is a social network/forum application with several services.

- **Frontend**: React + TypeScript SPA
- **Backend**: Node.js + TypeScript (Express)
- **Feed Service**: Rust microservice for feed generation
- **Search**: Elasticsearch utilities
- **Documentation**: Architecture and API docs in `docs/`
- **Infrastructure**: Docker-based development and production setup

```
orbitar/
├── frontend/           # React + TypeScript SPA
├── backend/            # Node.js + TypeScript (Express)
├── feed/               # Rust microservice for feed generation
├── search/             # Elasticsearch indexing utilities
├── docs/               # Architecture and API documentation
└── docker/             # Docker compose files
```

## Code Style

Formatting is controlled via `.prettierrc.yml`. Key settings:

- **Semicolons**: omitted (`semi: false`)
- **Trailing commas**: required (`trailingComma: "all"`)
- **Single quotes**: used for all strings
- **Indentation**: two spaces
- **Import order**: handled by `@ianvs/prettier-plugin-sort-imports` with the order defined in `.prettierrc.yml`

Reference lines:
```
1 printWidth: 120
2 semi: false
3 singleQuote: true
4 jsxSingleQuote: true
5 trailingComma: "all"
7 tabWidth: 2
13 plugins:
14   - "@ianvs/prettier-plugin-sort-imports"
15 importOrder:
16   - ^(react|react-router-dom)$
17   - ""
18   - <THIRD_PARTY_MODULES>
19   - ""
20   - ^(?!.*[.](css|scss|svg)$)[./].*$
21   - ""
22   - .(css|scss|svg)$
```
from `.prettierrc.yml`.

Inline `//` comments are used throughout the codebase and are allowed.

## File Placement

- **React components** are located directly in `frontend/src/Components/`:
```
CommentComponent.module.scss
CommentComponent.tsx
...
```
- **Pages** reside in `frontend/src/Pages/`
- **Backend API handlers** are in `backend/src/api/`
- **Backend business logic** in `backend/src/managers/`
- **Database migrations** live under `backend/migrations/`

## Development Scripts

At the repository root:

- `npm run lint` – run linters for backend and frontend

Within `frontend/` and `backend/` you can run:

- `npm run lint`
- `npm run test`
- `npm run prettier` and `npm run prettier:fix`

## References

- Architecture overview: `docs/architecture.md`
- API documentation: `docs/api/README.md`
- Admin cache server (loopback-only ops endpoints): `docs/admin-server.md`
