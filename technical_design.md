# Event Aggregator API – Technical Design Document (Serverless Cache Control Version)

## 1. Overview

This system provides an Express.js API to serve event data stored in a Supabase database. It retrieves data from EDM Train and Ticketmaster using a **serverless-compatible approach**. Instead of in-memory caching or scheduled jobs:

* Each request checks a **database-driven cache control system**.
* If data is stale, the system:
  * Returns current database data immediately (fast response).
  * Triggers a **webhook-based background fetch** for fresh data.
  * Subsequent requests receive updated data from the database.

This approach is **fully stateless** and **serverless-ready** (Vercel, AWS Lambda, etc.).

---

## 2. Architecture Components

1. **Express.js API** – Serves `/api/v1/events/:id/:city`, manages cache control, triggers webhooks.
2. **Cache Control Service** – Database-driven TTL management using Supabase `cache_control` table (6-hour TTL).
3. **Supabase (PostgreSQL)** – Persistent storage for events and cache metadata.
4. **Webhook System** – Serverless-compatible background processing:
   * `/api/webhook/fetch-data` endpoint for async data fetching.
   * Automatic environment detection (direct execution in dev, webhook in production).
5. **External APIs** – EDM Train and Ticketmaster as data providers.
6. **Transform & Validation Utilities** – Normalize external data into a unified schema.
7. **Logging** – Comprehensive request, cache, and job activity tracking.

---

## 3. Data Flow

### 3.1 User Request (GET `/api/v1/events/:id/:city`)

1. **Cache Control Check**:
   * Query `cache_control` table for location TTL status.
   * If cache is fresh (<6 hours) → proceed to return database data.
   * If cache is stale or missing → trigger background refresh + return current data.

2. **Immediate Database Response**:
   * Query `partner_events` table for existing events.
   * Return current data immediately (ensures fast response times).
   * Include `cacheStatus` field indicating if data is being refreshed.

3. **Background Refresh** (if needed):
   * **Development**: Direct execution of `fetchData.execute()`.
   * **Production**: Webhook call to `/api/webhook/fetch-data`.

### 3.2 Background Data Fetch (Webhook-based)

1. **Webhook Trigger**: POST to `/api/webhook/fetch-data` with city parameters.
2. **Data Fetching**: Parallel calls to EDM Train + Ticketmaster APIs.
3. **Transform & Store**: Normalize data → upsert to `partner_events` table.
4. **Cache Update**: Update `cache_control` table with new timestamp.

### 3.3 Manual Cleanup

* Run `npm run cleanup` to delete expired events from database.
* No cache invalidation needed (database-driven approach).

---

---

## 4. Database Schema

```sql
-- Events table
CREATE TABLE partner_events (
  id BIGINT PRIMARY KEY,
  source TEXT,
  name TEXT,
  venue JSONB,
  location_id INTEGER,
  date DATE,
  starttime TIME,
  endtime TIME,
  link TEXT,
  ages TEXT,
  festivalind BOOLEAN,
  livestreamind BOOLEAN,
  electronicgenreind BOOLEAN,
  othergenreind BOOLEAN,
  artistlist JSONB,
  createddate TIMESTAMP DEFAULT NOW()
);

-- Cache control table for TTL management
CREATE TABLE cache_control (
  location_id TEXT PRIMARY KEY,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_update TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '6 hours',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient cache queries
CREATE INDEX idx_cache_control_next_update ON cache_control (next_update);
```

---

## 5. API Endpoints

### GET `/api/v1/events/:id/:city`

* **Parameters**: City ID (numeric) and city name.
* **Returns**: Current database events with cache status.
* **Behavior**: If cache is stale → triggers background refresh + returns existing data.

### GET `/api/webhook/fetch-data` (POST)

* **Purpose**: Serverless-compatible background data fetching.
* **Authentication**: Bearer token via `WEBHOOK_SECRET`.
* **Parameters**: `{ cityId, cityName }`.

### GET `/health`

* **Returns**: API status and database connectivity.

### GET `/api/test/*` (Development only)

* **Test endpoints**: Individual and combined API testing.

---

## 6. File/Folder Structure

```
## 6. File/Folder Structure

```
/events-api
├── /src
│   ├── /api
│   │   ├── events.js          # /api/v1/events/:id/:city route
│   │   ├── webhook.js         # Webhook endpoints for serverless
│   │   ├── health.js          # Health check
│   │   └── test.js            # Development testing endpoints
│   ├── /jobs
│   │   ├── fetchData.js       # Combined data fetching logic
│   │   └── cleanup.js         # Delete old events (manual)
│   ├── /services
│   │   ├── edmTrain.js        # EDM Train API client
│   │   ├── ticketmaster.js    # Ticketmaster API client
│   │   ├── supabaseClient.js  # Supabase helper
│   │   ├── cacheControl.js    # Database-driven cache management
│   │   ├── backgroundJobs.js  # Webhook/direct execution handler
│   │   └── logger.js          # Logging utility
│   ├── /utils
│   │   ├── transform.js       # Data transformation logic
│   │   └── validate.js        # Optional validation
│   ├── /database
│   │   └── cache_control.sql  # Database schema for cache table
│   └── server.js              # Express app entry point
├── vercel.json                # Vercel deployment configuration
├── .env.vercel.template       # Environment variables template
└── package.json               # Dependencies and scripts
```

---
├── package.json
├── .env
└── README.md
```

## 7. Environment Variables

```bash
# Required for all environments
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
EDM_TRAIN_CLIENT_ID=<client-id>
TICKETMASTER_API_KEY=<api-key>
TICKETMASTER_SECRET=<secret>

# Webhook security
WEBHOOK_SECRET=<secure-random-string>

# Deployment-specific
NODE_ENV=production
PORT=8000

# Vercel automatically provides:
# VERCEL=1
# VERCEL_URL=<deployment-url>
```

---

## 8. Technology Stack

| Component        | Technology      | Reason                                        |
| ---------------- | --------------- | --------------------------------------------- |
| API Framework    | Express.js      | Lightweight and widely supported              |
| Cache Management | Supabase Table  | Database-driven, serverless-compatible        |
| Database         | Supabase        | Managed PostgreSQL, persistent storage       |
| Background Jobs  | Webhook-based   | Serverless-compatible async processing       |
| HTTP Client      | axios, fetch    | External API calls with built-in fetch       |
| Logging          | pino            | Structured logs with performance             |
| Deployment       | Vercel          | Serverless platform with zero-config        |

---

## 9. Serverless Advantages

### ✅ Pros

* **Fully stateless** - No server-side memory dependencies.
* **Serverless-ready** - Compatible with Vercel, AWS Lambda, etc.
* **Scalable** - Database-driven cache works across multiple instances.
* **Fast responses** - Always returns current data immediately.
* **Cost-effective** - No always-on background processes.
* **Reliable** - Webhook-based background processing.

### ⚠️ Considerations

* **Database queries** - Every request hits the database (mitigated by Supabase performance).
* **Webhook reliability** - Background fetches depend on webhook delivery.
* **Cold starts** - Initial serverless function startup time.

---

## 10. Deployment Guide

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Test endpoints
curl http://localhost:8000/api/v1/events/71/chicago
curl http://localhost:8000/health
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables in Vercel dashboard:
# SUPABASE_URL, SUPABASE_ANON_KEY, EDM_TRAIN_CLIENT_ID, 
# TICKETMASTER_API_KEY, TICKETMASTER_SECRET, WEBHOOK_SECRET

# Deploy
vercel --prod
```

### Database Setup

```sql
-- Run in Supabase SQL Editor
-- 1. Create cache_control table
\i src/database/cache_control.sql

-- 2. Ensure partner_events table exists with proper schema
-- (See schema in section 4)
```

---

## 11. API Usage Examples

### Get Events for Chicago

```bash
curl "https://your-app.vercel.app/api/v1/events/71/chicago"
```

**Response:**
```json
{
  "data": [...events...],
  "source": "database",
  "id": 71,
  "city": "chicago",
  "cacheStatus": "fresh",
  "count": 45
}
```

### Health Check

```bash
curl "https://your-app.vercel.app/health"
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-07-27T15:00:00.000Z",
  "uptime": 123.456,
  "environment": "production",
  "services": {
    "database": "OK"
  }
}
```

---
   * Node-Cache integration
   * Supabase fetch & upsert
3. Add Bree.js jobs for:

   * Fetch EDM Train
   * Fetch Ticketmaster
   * Cleanup old events
4. Write transformation utilities.
5. Add basic tests for routes and jobs.
6. Deploy single-instance service.
7. Monitor performance and memory usage.

---
