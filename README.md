# AICS - Course Institute Management System

A full-stack MERN application for managing a course institute with student management, course tracking, fee installments, certificates, and enquiries.

## Features

- Student Management - Enroll, track, and manage student records
- Course Tracking - Manage courses and batches
- Fee Installments - Track and manage fee payments
- Certificates - Generate and manage course certificates
- Enquiries - Handle student enquiries and follow-ups

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Express.js + MongoDB
- **Database**: MongoDB with Mongoose ODM

## Project Structure

```
AICS-PROJECT/
├── backend/          # Express.js API server
├── frontend/         # React 18 frontend
├── nginx/            # Nginx reverse proxy
├── compose.yaml      # Docker Compose config
└── uploads/          # File uploads storage
```

## Prerequisites

- Node.js 18+
- MongoDB
- Docker & Docker Compose (optional)
- npm or yarn

## Getting Started

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

The API runs on `http://localhost:5000` by default.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

### Docker (Full Stack)

```bash
docker compose up --build
```

This starts all services: frontend, backend, and MongoDB.

## Environment Variables

Create `.env` files based on `.env.example`:

- `backend/.env` - Backend configuration
- `frontend/.env` - Frontend configuration

## API Documentation

The API runs at `/api` endpoint. Key routes:

- `/api/students` - Student management
- `/api/courses` - Course management
- `/api/batches` - Batch management
- `/api/fees` - Fee management
- `/api/enquiries` - Enquiry management

## License

Proprietary - All rights reserved