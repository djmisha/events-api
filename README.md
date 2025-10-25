# Events API

**Serverless Event Aggregator API** - Fetches and serves event data from EDM Train and Ticketmaster APIs with database-driven cache control.

## Overview

This system provides an Express.js API to serve event data stored in a Supabase database. It uses a **serverless-compatible approach** with database-driven cache management:

- Each request checks a **cache control table** for data freshness (6-hour TTL)
- If data is stale, the system:
  - Returns current database data immediately (fast response)
  - Triggers **webhook-based background fetch** for fresh data
  - Subsequent requests receive updated data from the database

**Key Benefits**: Fully stateless, serverless-ready, fast responses, scalable across instances.

## Architecture

- **Express.js API** – Serves `/api/v1/events/:id/:city`, manages cache control
- **Cache Control Service** – Database-driven TTL management via Supabase table
- **Supabase (PostgreSQL)** – Persistent storage for events and cache metadata
- **Webhook System** – Serverless-compatible background processing
- **External APIs** – EDM Train and Ticketmaster as data providers

## Features

- 🚀 **Serverless-ready** - Compatible with Vercel, AWS Lambda, etc.
- ⚡ **Fast responses** - Always returns current data immediately
- 🔄 **Background refresh** - Webhook-based async data updates
- 🗄️ **Database-driven cache** - No server-side memory dependencies
- 🧹 **Manual cleanup** - Remove expired events via npm script
- 📊 **Health monitoring** - Database connectivity checks
- 📝 **Structured logging** - Comprehensive request and error tracking

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- Supabase account and project
- EDM Train Client ID
- Ticketmaster API credentials

### Database Setup

The system uses a normalized relational schema for venues, artists, and events in **new tables** that don't interfere with existing data.

#### Setup for New Installations

Run the schema creation SQL file in your Supabase SQL Editor:
- File: `src/database/schema_new.sql`
- This creates: `venues`, `artists`, `events_v2`, and `event_artists` tables
- Also creates `cache_control` table if it doesn't exist

**New Tables Created:**
- `venues` - Venue records with UUID primary keys
- `artists` - Artist records with UUID primary keys
- `events_v2` - Normalized event records with foreign keys
- `event_artists` - Many-to-many join table for event-artist relationships

The existing `partner_events` table is left untouched and can coexist with the new schema.

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd events-api
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template and configure:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file with your actual values:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   EDM_TRAIN_CLIENT_ID=your-client-id
   TICKETMASTER_API_KEY=your-api-key
   TICKETMASTER_SECRET=your-secret
   WEBHOOK_SECRET=your-secure-random-string
   ```

### Running the Application

#### Development Mode

```bash
npm run dev
```

This starts the server with nodemon for automatic restarts on file changes.

#### Production Mode

```bash
npm start
```

#### Manual Cleanup

To remove expired events from the database:

```bash
npm run cleanup
```

### Deployment

#### Vercel Deployment

1. Install Vercel CLI:

   ```bash
   npm i -g vercel
   ```

2. Set environment variables in Vercel dashboard

3. Deploy:
   ```bash
   vercel --prod
   ```

The server will start on port 8000 by default. You can set a different port using the `PORT` environment variable.

## API Endpoints

### Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://your-app.vercel.app`

### Main Endpoints

#### GET `/api/v1/events/:id/:city`

Fetch events for a specific city using path parameters.

**Parameters:**

- `id` (required): Numeric city identifier
- `city` (required): URL-encoded city name

**Example:**

```
GET /api/v1/events/71/chicago
GET /api/v1/events/456/new%20york
```

**Response:**

```json
{
  "source": "database",
  "id": 71,
  "city": "chicago",
  "cacheStatus": "fresh",
  "count": 45,
  "data": [
    {
      "id": 12345,
      "name": "Event Name",
      "date": "2025-11-01",
      "starttime": "20:00:00",
      "venue": {
        "id": "uuid",
        "name": "Venue Name",
        "city": "Chicago",
        "state": "IL",
        "country": "USA"
      },
      "artists": [
        {
          "id": "uuid",
          "name": "Artist Name",
          "external_id": "edmtrain:123"
        }
      ]
    }
  ]
}
```

**Status Codes:**

- `200`: Events returned successfully
- `202`: Background fetch triggered, data being updated
- `400`: Invalid parameters
- `500`: Server error

#### GET `/health`

Check API health and service status.

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

#### POST `/api/webhook/fetch-partner-data`

Serverless background data fetching endpoint (internal use).

**Headers:**

```
Authorization: Bearer <WEBHOOK_SECRET>
Content-Type: application/json
```

**Body:**

```json
{
  "cityId": "71",
  "cityName": "chicago"
}
```

### Test Endpoints (Development Only)

Available when `NODE_ENV=development`:

#### GET `/api/test/edmtrain/:id/:city`

Test EDM Train API directly.

#### GET `/api/test/ticketmaster/:id/:city`

Test Ticketmaster API directly.

#### GET `/api/test/combined/:id/:city`

Test both APIs and see combined results.

## Project Structure

```
/events-api
├── /src
│   ├── /api
│   │   ├── events.js          # Main events endpoint
│   │   ├── webhook.js         # Webhook endpoints
│   │   ├── health.js          # Health check
│   │   └── test.js            # Test endpoints (dev only)
│   ├── /jobs
│   │   ├── fetchPartnerData.js       # Combined data fetching logic
│   │   └── cleanup.js         # Manual cleanup job
│   ├── /services
│   │   ├── edmTrain.js        # EDM Train API client
│   │   ├── ticketmaster.js    # Ticketmaster API client
│   │   ├── supabaseClient.js  # Supabase helper
│   │   ├── cacheControl.js    # Database cache management
│   │   ├── backgroundJobs.js  # Webhook/direct execution handler
│   │   └── logger.js          # Logging utility
│   ├── /utils
│   │   ├── transform.js       # Data transformation logic
│   │   └── validate.js        # Data validation
│   ├── /database
│   │   └── cache_control.sql  # Database schema
│   └── server.js              # Express app entry point
├── vercel.json                # Vercel deployment config
├── .env.vercel.template       # Environment variables template
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## Environment Variables

Required environment variables:

```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# External APIs
EDM_TRAIN_CLIENT_ID=your-client-id
TICKETMASTER_API_KEY=your-api-key
TICKETMASTER_SECRET=your-secret

# Webhook Security
WEBHOOK_SECRET=your-secure-random-string

# Application
NODE_ENV=production
PORT=8000
```

## Data Flow

1. **User Request**: GET `/api/v1/events/:id/:city`
2. **Cache Check**: Query `cache_control` table for TTL status
3. **Database Query**: Fetch current events from `partner_events` table
4. **Immediate Response**: Return current data with cache status
5. **Background Refresh** (if stale):
   - Development: Direct execution
   - Production: Webhook call to `/api/webhook/fetch-partner-data`
6. **Background Update**: Fetch → Transform → Save → Update cache timestamp

## Serverless Benefits

- ✅ **Stateless**: No server-side memory dependencies
- ✅ **Scalable**: Database-driven cache works across instances
- ✅ **Fast**: Always returns current data immediately
- ✅ **Reliable**: Webhook-based background processing
- ✅ **Cost-effective**: No always-on background processes

## Contributing

1. Follow the coding conventions in `.github/copilot-instructions.md`
2. Test endpoints thoroughly
3. Ensure proper error handling
4. Update documentation for new features

## License

ISC
