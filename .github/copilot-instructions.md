# Events API - GitHub Copilot Instructions

This is a serverless-ready Express.js API for aggregating event data from multiple sources (EDM Train and Ticketmaster) with database-driven cache management using Supabase.

## Code Style and Patterns

### JavaScript Standards
- Use **modern JavaScript (ES6+)** features: arrow functions, async/await, destructuring, template literals
- Use **const** and **let** instead of **var**
- Use **async/await** for asynchronous operations instead of callbacks or `.then()` chains
- Use **require()** for module imports (CommonJS) - this is a Node.js project, not ES modules
- Use **descriptive variable and function names** that clearly convey purpose
- Keep functions **small and focused** - each should do one thing well
- Add **JSDoc comments** for public functions and complex logic

### Express.js Best Practices
- Follow **RESTful conventions** for routing (GET, POST, PUT, DELETE)
- Use **Express Router** for modular route handling
- Implement **proper middleware order**: CORS → body parser → logging → authentication → routes → error handling
- Always include **proper HTTP status codes** in responses (200, 201, 400, 401, 403, 404, 500)
- Return **consistent JSON response formats** across all endpoints
- Handle **errors gracefully** with try-catch blocks and error middleware

## Project Structure

### Directory Organization
```
/src
├── /api          - Route handlers (events, webhook, health, test)
├── /jobs         - Background job logic (fetchPartnerData, cleanup)
├── /middleware   - Express middleware (apiKeyAuth)
├── /services     - Business logic and external integrations
├── /utils        - Helper functions (transform, validate)
└── server.js     - Express app entry point
```

### Key Files
- **`src/server.js`** - Main Express application setup and configuration
- **`src/api/events.js`** - Primary events endpoint (`/api/v1/events/:id/:city`)
- **`src/api/webhook.js`** - Webhook for background processing
- **`src/services/cacheControl.js`** - Database-driven cache management
- **`src/services/backgroundJobs.js`** - Async job execution handler
- **`src/jobs/fetchPartnerData.js`** - Combined data fetching from external APIs

## API Design Conventions

### Endpoint Standards
- All API endpoints must be under **`/api/`** prefix
- Use **versioning** for public APIs: `/api/v1/events`
- Use **path parameters** for required identifiers: `/api/v1/events/:id/:city`
- Use **query parameters** for optional filters and pagination
- **Main endpoint**: `/api/v1/events/:id/:city` (requires API key authentication)
- **Webhook endpoint**: `/api/webhook/fetch-partner-data` (requires WEBHOOK_SECRET)
- **Health check**: `/health` (public, no authentication)

### Request/Response Format
- All requests and responses use **JSON format**
- Include **appropriate error messages** with clear, actionable information
- Response structure should include:
  - `data`: The actual response payload
  - `error`: Error message (if applicable)
  - `message`: Human-readable message
  - Metadata fields: `count`, `source`, `cacheStatus`, etc.

### HTTP Status Codes
- **200 OK**: Successful request with data
- **202 Accepted**: Request accepted, background processing triggered
- **400 Bad Request**: Invalid parameters or request format
- **401 Unauthorized**: Missing authentication
- **403 Forbidden**: Invalid credentials
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side errors

## Architecture Principles

### Serverless-Ready Design
- **No server-side state or memory dependencies** - all state in database
- **Database-driven cache** using Supabase `cache_control` table (6-hour TTL)
- **Stateless request handling** - each request is independent
- **Webhook-based background jobs** for async processing (`/api/webhook/fetch-partner-data`)
- **Environment detection**: Direct execution in development, webhook calls in production

### Cache Control Flow
1. Request arrives at `/api/v1/events/:id/:city`
2. Check `cache_control` table for TTL status
3. Return current data from `partner_events` table immediately (fast response)
4. If cache is stale, trigger background refresh via webhook
5. Background job fetches fresh data and updates database
6. Next request receives updated data

### Background Processing
- **Development**: Direct execution via `fetchPartnerData.execute()`
- **Production**: HTTP POST to `/api/webhook/fetch-partner-data` with Bearer token
- Use `src/services/backgroundJobs.js` for environment-aware execution
- All background jobs must be **idempotent** (safe to run multiple times)

## Dependencies and Internal Libraries

### Core Dependencies
- **express** - Web framework
- **@supabase/supabase-js** - Database client for PostgreSQL operations
- **axios** - HTTP client for external API calls (EDM Train, Ticketmaster)
- **joi** - Request validation and data schema validation
- **dotenv** - Environment variable management
- **cors** - Cross-origin resource sharing middleware

### Logging
- **Always use `logger`** from `src/services/logger.js`, never `console.log()`
- Logger uses **pino** for structured logging with pretty printing in development
- Log levels: `logger.info()`, `logger.warn()`, `logger.error()`
- Include **context** in logs: method, path, IP, parameters, errors

### Database Operations
- Use **`supabase`** client from `src/services/supabaseClient.js`
- All database queries should use **prepared statements** (Supabase does this by default)
- Use **.upsert()** for insert/update operations to handle duplicates
- Handle database errors gracefully with try-catch

### External API Clients
- **EDM Train**: Use `src/services/edmTrain.js` - requires `EDM_TRAIN_CLIENT_ID`
- **Ticketmaster**: Use `src/services/ticketmaster.js` - requires `TICKETMASTER_API_KEY` and `TICKETMASTER_SECRET`
- Always handle API failures gracefully - one API failure shouldn't break the entire request
- Transform external data using `src/utils/transform.js` before storing

## Error Handling

### Best Practices
- Wrap async operations in **try-catch blocks**
- Use Express **error handling middleware** for unhandled errors
- Log errors with **full context** including stack traces
- Return **user-friendly error messages** in production (hide internals)
- Return **detailed error messages** in development for debugging
- Validate input early using Joi schemas from `src/utils/validate.js`

### Error Response Format
```javascript
{
  error: "Error type or category",
  message: "Human-readable error description",
  details: {...} // Optional, only in development
}
```

## Authentication and Security

### API Key Authentication
- Protected endpoints use **`apiKeyAuth` middleware** from `src/middleware/apiKeyAuth.js`
- API keys can be provided via:
  - Header: `x-api-key: YOUR_API_KEY`
  - Query param: `?api_key=YOUR_API_KEY`
  - Bearer token: `Authorization: Bearer YOUR_API_KEY`
- Valid keys defined in **`API_KEYS`** environment variable (comma-separated)

### Webhook Authentication
- Webhook endpoint uses **`WEBHOOK_SECRET`** for Bearer token authentication
- Format: `Authorization: Bearer YOUR_WEBHOOK_SECRET`
- Validate token before processing webhook requests

### Security Guidelines
- **Never log sensitive data**: API keys, secrets, tokens, passwords
- **Never commit secrets** to source code - use environment variables
- Use **HTTPS** in production (enforced by deployment platform)
- Validate all external input before processing
- Set appropriate **CORS policies** for cross-origin requests

## Testing and Development

### Development Mode
- Run with **`npm run dev`** - uses nodemon for auto-restart
- Development-only test endpoints available at `/api/test/*`
- More verbose logging with **pino-pretty** formatting
- Root endpoint (`/`) shows API documentation (hidden in production)

### Available npm Scripts
- **`npm start`** - Production mode
- **`npm run dev`** - Development mode with auto-restart
- **`npm run cleanup`** - Manual cleanup job to remove expired events
- **`npm run build`** - No-op (Node.js doesn't need build step)

### Testing Endpoints
When adding test endpoints:
- Only available when `NODE_ENV=development`
- Mount under `/api/test/*` route
- No authentication required for easier testing
- Include in `src/api/test.js`

## Environment Configuration

### Required Environment Variables
```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# External APIs
EDM_TRAIN_CLIENT_ID=your-client-id
TICKETMASTER_API_KEY=your-api-key
TICKETMASTER_SECRET=your-secret

# Authentication
API_KEYS=key1,key2,key3  # Comma-separated
WEBHOOK_SECRET=your-secure-random-string

# Application
NODE_ENV=production|development
PORT=8000
LOG_LEVEL=info|debug|warn|error
```

### Environment Detection
- Use **`process.env.NODE_ENV`** to detect environment
- Development features gated behind `NODE_ENV === "development"`
- Production optimizations in production mode (no pretty logging, hidden docs)

## Database Schema

### Tables
- **`partner_events`** - Stores event data from external APIs
- **`cache_control`** - Manages cache TTL per location (6-hour default)

### Cache Control Management
- Use **`src/services/cacheControl.js`** for all cache operations
- Methods: `shouldRefresh()`, `markRefreshed()`, `getCacheStatus()`
- TTL is **6 hours** by default (configurable in database)

## Data Transformation

### External API Data
- Transform external API responses using **`src/utils/transform.js`**
- Normalize field names to internal schema
- Handle missing or null fields gracefully
- Combine data from multiple sources before storing
- Validate transformed data using schemas in `src/utils/validate.js`

## Deployment

### Vercel Deployment
- Platform: **Vercel** (serverless)
- Configuration: **`vercel.json`** defines route rewrites
- Entry point: **`api/index.js`** (re-exports `src/server.js`)
- Environment variables: Set in Vercel dashboard
- No build step required for Node.js

### Compatibility
- Designed for **serverless platforms**: Vercel, AWS Lambda, Google Cloud Functions
- No long-running processes or background workers
- All state in database, not in memory
- Stateless request handling

## Common Patterns

### Making External API Calls
```javascript
const axios = require('axios');
const logger = require('./services/logger');

try {
  const response = await axios.get(url, { params, headers });
  return response.data;
} catch (error) {
  logger.error('API call failed:', { url, error: error.message });
  throw error;
}
```

### Database Upsert
```javascript
const { data, error } = await supabase
  .from('partner_events')
  .upsert(events, { onConflict: 'id' });

if (error) {
  logger.error('Database upsert failed:', error);
  throw error;
}
```

### Triggering Background Jobs
```javascript
const backgroundJobs = require('./services/backgroundJobs');

await backgroundJobs.triggerFetchPartnerData({
  cityId: id,
  cityName: city
});
```

## Important Notes

- This project follows **RESTful conventions** strictly
- Always consider **serverless constraints** when adding features
- **Optimize for fast responses** - defer heavy processing to webhooks
- Test endpoints in both **development and production modes**
- Keep **webhook payloads small** for reliability
- Document new environment variables in README.md and `.env.example`
