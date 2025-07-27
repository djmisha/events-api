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

Create the required tables in your Supabase database:

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

-- Cache control table
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
  venue TEXT,
  city TEXT,
  date TIMESTAMP,
  url TEXT,
  genre TEXT[],
  inserted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE city_metadata (
  city_id TEXT PRIMARY KEY,
  last_updated TIMESTAMP
);
```

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` file with your actual values:
   - Supabase URL and service key
   - API keys for EDM Train and Ticketmaster (optional)

### Running the Application

#### Development Mode

```bash
npm run dev
```

This will start the server with nodemon, which automatically restarts when you make changes.

#### Production Mode

```bash
npm start
```

#### Running Background Jobs

To run the scheduled cleanup job:

```bash
npm run cron
```

The server will start on port 3000 by default. You can set a different port using the `PORT` environment variable.

## API Endpoints

### Base URL

`http://localhost:3000`

### Endpoints

#### GET `/api/v1/events/:id/:city`

Fetch events for a specific city using router parameters.

**Parameters:**

- `id` (required): Numeric city identifier
- `city` (required): URL-encoded city name (used by Ticketmaster)

**Example:**

```
GET /api/v1/events/123/chicago
GET /api/v1/events/456/new%20york
```

**Response:**

```json
{
  "data": [...events],
  "source": "cache|database",
  "id": 123,
  "city": "chicago",
  "lastUpdated": "2025-01-01T00:00:00Z"
}
```

**Status Codes:**

- `200`: Events returned from cache or fresh database data
- `202`: Background fetch triggered, try again soon
- `400`: Missing city ID parameter
- `500`: Server error

#### GET `/health`

Check API health and service status.

**Response:**

```json
{
  "status": "OK",
  "timestamp": "2025-01-01T00:00:00Z",
  "uptime": 3600,
  "environment": "development",
  "services": {
    "cache": "OK",
    "database": "OK"
  }
}
```

### Test Endpoints (Development Only)

These endpoints are only available when `NODE_ENV=development` for testing the external APIs directly.

#### GET `/api/test/edmtrain?cityId=123&cityName=chicago`

Test the EDM Train API directly.

**Parameters:**

- `cityId` (required): Numeric city identifier
- `cityName` (required): City name

**Response:**

```json
{
  "source": "edmtrain",
  "cityId": 123,
  "cityName": "chicago",
  "rawCount": 5,
  "transformedCount": 5,
  "rawData": [...],
  "transformedData": [...]
}
```

#### GET `/api/test/ticketmaster?cityId=123&cityName=chicago`

Test the Ticketmaster API directly.

**Parameters:**

- `cityId` (required): Numeric city identifier
- `cityName` (required): URL-encoded city name

**Response:**

```json
{
  "source": "ticketmaster",
  "cityId": 123,
  "cityName": "chicago",
  "rawCount": 10,
  "transformedCount": 10,
  "rawData": [...],
  "transformedData": [...]
}
```

#### GET `/api/test/combined?cityId=123&cityName=chicago`

Test both APIs and see the combined results.

**Parameters:**

- `cityId` (required): Numeric city identifier
- `cityName` (required): URL-encoded city name

**Response:**

```json
{
  "cityId": 123,
  "cityName": "chicago",
  "edmtrain": {
    "status": "fulfilled",
    "data": [...],
    "transformed": [...]
  },
  "ticketmaster": {
    "status": "fulfilled",
    "data": [...],
    "transformed": [...]
  },
  "combined": {
    "totalEvents": 15,
    "events": [...]
  }
}
```

## Project Structure

```
/events-api
├── /src
│   ├── /api
│   │   ├── events.js          # /api/v1/events route
│   │   ├── health.js          # Health check
│   │   └── test.js            # Test endpoints (dev only)
│   ├── /jobs
│   │   ├── backgroundFetch.js # Background fetch trigger
│   │   ├── fetchData.js       # Data fetching job
│   │   ├── cleanup.js         # Delete old events
│   │   └── index.js           # Bree.js job scheduler
│   ├── /services
│   │   ├── edmTrain.js        # EDM Train API client
│   │   ├── ticketmaster.js    # Ticketmaster API client
│   │   ├── supabaseClient.js  # Supabase helper
│   │   ├── cache.js           # Node-Cache wrapper
│   │   └── logger.js          # Logging utility
│   ├── /utils
│   │   ├── transform.js       # Data transformation logic
│   │   └── validate.js        # Data validation
│   ├── server.js              # Express app entry point
│   └── cron.js                # Loads Bree jobs
├── package.json
├── .env.example
└── README.md
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# External API Keys
EDM_TRAIN_API_KEY=your-edm-train-key
TICKETMASTER_API_KEY=your-ticketmaster-key

# Cache Configuration
CACHE_TTL_SECONDS=21600
```

## Data Flow

1. **User Request**: GET `/api/v1/events?id=cityId`
2. **Cache Check**: Check Node-Cache for events
3. **Database Check**: If cache miss, check Supabase for fresh data
4. **Background Fetch**: If data is stale/missing, trigger background job
5. **Response**: Return available data immediately
6. **Background Update**: Fetch from APIs → Transform → Save to DB → Update cache

## Deployment

This API is designed for single-instance deployment. For production:

1. Set `NODE_ENV=production`
2. Configure production database URLs
3. Set appropriate log levels
4. Consider memory usage monitoring
5. Set up process management (PM2, systemd, etc.)

## License

ISC

````

### Endpoints

- **GET /** - Welcome message with API information
- **GET /health** - Health check endpoint
- **GET /api/events** - Get all events
- **POST /api/events** - Create a new event

### Example Usage

#### Get all events

```bash
curl http://localhost:8080/api/events
````

#### Create a new event

```bash
curl -X POST http://localhost:8080/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tech Conference",
    "description": "Annual technology conference",
    "date": "2025-09-15",
    "location": "Convention Center"
  }'
```

## Project Structure

```
events-api/
├── app.js              # Main application file
├── package.json        # Project dependencies and scripts
├── README.md          # This file
└── .github/
    └── copilot-instructions.md  # Copilot customization
```

## Development

- The main application logic is in `app.js`
- Uses Express.js for the web framework
- Includes basic middleware for JSON parsing and error handling
- Nodemon is configured for development auto-reload

## Contributing

1. Make your changes
2. Test the API endpoints
3. Ensure proper error handling
4. Follow the coding conventions outlined in `.github/copilot-instructions.md`
