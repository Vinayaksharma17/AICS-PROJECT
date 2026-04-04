# Agent Instructions for AICS Project

This is a full-stack MERN application for a Course Institute Management System with student management, course tracking, fee installments, certificates, and enquiries.

## Project Structure

```
AICS-PROJECT/
├── backend/                 # Express.js + MongoDB API
│   ├── controllers/        # Route handlers
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API route definitions
│   ├── middleware/         # Auth, error handling, uploads
│   ├── utils/              # Invoice generator, helpers
│   ├── config/             # Database connection
│   ├── server.js           # Entry point
│   └── package.json
├── frontend/               # React 18 + Vite
│   ├── src/
│   │   ├── pages/         # Page components (admin/, staff/)
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # React context providers
│   │   ├── utils/         # API client, helpers
│   │   └── styles/        # CSS files
│   └── package.json
├── nginx/                  # Nginx reverse proxy config
├── compose.yaml           # Docker Compose for full stack
└── uploads/               # File uploads storage
```

## Commands

### Backend
```bash
cd backend
npm install              # Install dependencies
npm run dev              # Start with nodemon (development)
npm start                # Start with node (production)
```

### Frontend
```bash
cd frontend
npm install              # Install dependencies
npm run dev               # Start Vite dev server
npm run build             # Production build
npm run preview           # Preview production build
```

### Docker (Full Stack)
```bash
docker compose up --build    # Build and start all services
docker compose watch         # Watch mode: rebuild on file changes
docker compose down          # Stop all services
docker compose logs -f       # View logs
```

## Code Style Guidelines

### JavaScript/Node.js (Backend)

- **Modules**: Use CommonJS (`require`/`module.exports`) — NOT ES modules
- **Schema Definitions**: Mongoose schemas use inline field definitions with validation arrays
  ```js
  fieldName: { type: String, required: [true, 'Error message'], trim: true }
  ```
- **Async/Await**: Always use `async/await` in controllers; wrap in try/catch
- **Error Handling**: Controllers return `res.status(code).json({ message })` on errors
- **Controller Pattern**: One file per resource (`studentController.js` for students)
- **File Uploads**: Use Multer with field names matching frontend form fields
- **Environment Variables**: Always use `process.env.VAR_NAME`; never hardcode secrets
- **Naming**: camelCase for variables/functions, PascalCase for models, SCREAMING_SNAKE_CASE for env vars

### React/JSX (Frontend)

- **Component Files**: `.jsx` extension; use named exports for pages, default exports for pages
- **Imports Order**: React hooks → library imports → local components → local utils → CSS
  ```jsx
  import React, { useState, useEffect } from 'react';
  import api from '../../utils/api';
  import './Component.css';
  ```
- **State Management**: Use `useState` for local state; `useContext` for global auth state
- **Form Handling**: Controlled inputs with onChange handlers; validation before submission
- **Error Display**: Show inline errors below inputs with `form-error` class
- **CSS Classes**: Use existing utility classes (`btn btn-primary`, `form-input`, `modal`, etc.)
- **API Calls**: Use the `api` utility from `src/utils/api.js` with auto-attached JWT token
- **Environment Vars**: Prefix with `VITE_` (e.g., `VITE_API_URL`)

### Database/Mongoose

- **ObjectId References**: Always use `{ type: mongoose.Schema.Types.ObjectId, ref: 'ModelName' }`
- **Virtual Fields**: Use `.virtual()` for computed fields; call `.set()` to include in JSON
- **Pre-save Hooks**: Use `schema.pre('save')` for data transformations
- **Enums**: Define allowed values explicitly: `{ type: String, enum: ['active', 'inactive'] }`
- **Timestamps**: Use `{ timestamps: true }` or manual `createdAt`/`updatedAt`

### API Design

- **RESTful Routes**: `/api/resource` for collections, `/api/resource/:id` for items
- **Response Format**: Always return `{ message, ...data }` or `{ message, resource: {...} }`
- **Status Codes**: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error)
- **Authentication**: JWT Bearer token in Authorization header; `/uploads` route validates token

### File Organization

- Backend: Keep controllers focused; extract helpers to `utils/`
- Frontend: Pages in `pages/admin/` or `pages/staff/`; shared components in `components/`
- CSS: Shared styles in `styles/`; component-specific styles alongside components

### Security Practices

- Never log secrets or tokens
- Validate file uploads (size limits, type checking)
- Sanitize user inputs before database operations
- Use parameterized queries (Mongoose handles this)
- Keep `NODE_ENV=production` in deployment

## Common Patterns

### Adding a New Model
1. Create `models/NewModel.js` with Mongoose schema
2. Create `controllers/newModelController.js` with CRUD operations
3. Create `routes/newModelRoutes.js` with Express router
4. Register route in `server.js`: `app.use('/api/newmodels', require('./routes/newModelRoutes'))`

### Adding a New Frontend Page
1. Create page component in appropriate `pages/admin/` or `pages/staff/` folder
2. Add route in `App.jsx` with proper authentication guard
3. Use existing modal patterns from codebase
4. Follow form validation pattern: validate → setErrors → return boolean

### Docker Development
- Use `docker compose watch` for hot-reload on both frontend and backend
- Changes to Dockerfile require rebuild: `docker compose up --build`
- Volume mounts enable file watching; `develop.watch` config specifies paths to watch

## Testing

This project does not currently have automated tests. When adding tests:
- Backend: Use Jest with `supertest` for API testing
- Frontend: Use Vitest + React Testing Library
- Run single test: `npm test -- --run <filename>` or use your test runner's specific syntax
