# Events API

**Serverless Event Aggregator API** - TypeScript-based API that fetches and serves event data from EDM Train and Ticketmaster APIs with database-driven cache control.

## Overview

This system provides a TypeScript Express.js API to serve event data stored in a Supabase database. It uses a **serverless-compatible approach** with database-driven cache management:

- Each request checks a **cache control table** for data freshness (6-hour TTL)
- If data is stale, the system:
  - Returns current database data immediately (fast response)
  - Triggers **webhook-based background fetch** for fresh data
  - Subsequent requests receive updated data from the database

**Key Benefits**: Fully stateless, serverless-ready, fast responses, scalable across instances, type-safe with TypeScript.

## Architecture

- **TypeScript Express.js API** – Serves `/api/v1/events/:id/:city`, manages cache control
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
- 🔒 **Type Safety** - Full TypeScript implementation with strict typing
- 🛠️ **Developer Experience** - ESLint, Prettier, and pre-commit hooks

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- TypeScript (installed as dev dependency)
- Supabase account and project
- EDM Train Client ID
- Ticketmaster API credentials

### Database Setup

The system uses a normalized relational schema with the `prtnr_` prefix for all tables.

#### Setup for New Installations

Run the schema creation SQL file in your Supabase SQL Editor:

- File: `src/database/schema.sql`
- This creates: `prtnr_venues`, `prtnr_artists`, `prtnr_events`, and `prtnr_event_artists` tables
- Also creates `cache_control` table if it doesn't exist

**New Tables Created:**

- `prtnr_venues` - Venue records with UUID primary keys
- `prtnr_artists` - Artist records with UUID primary keys
- `prtnr_events` - Normalized event records with foreign keys
- `prtnr_event_artists` - Many-to-many join table for event-artist relationships

The existing `partner_events` table is left untouched and can coexist with the new schema.

See `FRESH_SETUP.md` for detailed setup instructions.

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
   API_KEYS=your-api-key-for-authentication
   ```

### Running the Application

#### Development Mode

```bash
npm run dev
```

This starts the TypeScript server with ts-node and nodemon for automatic restarts on file changes.

#### Production Mode

```bash
npm run build
npm start
```

The build command compiles TypeScript to JavaScript in the `dist/` directory.

#### Manual Cleanup

To remove expired events from the database:

```bash
npm run cleanup
```

### Development Tools

#### TypeScript Compilation

```bash
npm run build
```

Compiles TypeScript files to the `dist/` directory with source maps and type declarations.

#### Code Quality

```bash
npm run lint
```

Runs ESLint on both JavaScript and TypeScript files, Prettier for formatting, and TypeScript compiler checks.

### Deployment

#### Vercel Deployment (TypeScript)

The project is configured for seamless TypeScript deployment on Vercel:

1. **Install Vercel CLI:**

   ```bash
   npm i -g vercel
   ```

2. **Set environment variables in Vercel dashboard:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `API_KEYS`
   - `WEBHOOK_SECRET`
   - `EDM_TRAIN_CLIENT_ID`
   - `TICKETMASTER_API_KEY`

3. **Deploy:**
   ```bash
   vercel --prod
   ```

**Deployment Process:**

- Vercel automatically runs `npm run build` (TypeScript compilation)
- Compiled JavaScript is served from `/dist` directory
- Serverless functions use the compiled code for optimal performance
- Source maps are included for debugging

**Vercel Configuration:**

- `vercel.json` handles TypeScript build process
- `api/index.js` imports compiled server from `/dist`
- Functions include compiled assets via `includeFiles`

#### Local Production Testing

Test the production build locally:

```bash
npm run test-build
```

This compiles TypeScript and runs the production server.

## Project Structure

```
/events-api
├── /src                        # TypeScript source files
│   ├── /api
│   │   ├── events.ts          # Main events endpoint
│   │   ├── webhook.ts         # Webhook endpoints
│   │   ├── health.ts          # Health check
│   │   └── test.ts            # Test endpoints (dev only)
│   ├── /jobs
│   │   ├── fetchPartnerData.ts       # Combined data fetching logic
│   │   └── cleanup.ts         # Manual cleanup job
│   ├── /services
│   │   ├── edmTrain.ts        # EDM Train API client
│   │   ├── ticketmaster.ts    # Ticketmaster API client
│   │   ├── supabaseClient.ts  # Supabase helper
│   │   ├── cacheControl.ts    # Database cache management
│   │   ├── backgroundJobs.ts  # Webhook/direct execution handler
│   │   └── logger.ts          # Logging utility
│   ├── /middleware
│   │   └── apiKeyAuth.ts      # API key authentication
│   ├── /utils
│   │   ├── transform.ts       # Data transformation logic
│   │   └── validate.ts        # Data validation
│   ├── /types
│   │   └── index.ts           # TypeScript type definitions
│   └── server.ts              # Express app entry point
├── /dist                       # Compiled JavaScript (generated)
├── tsconfig.json              # TypeScript configuration
├── .eslintrc.js               # ESLint configuration
├── .prettierrc                # Prettier configuration
├── vercel.json                # Vercel deployment config
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

# Authentication
API_KEYS=comma,separated,api,keys

# Webhook Security
WEBHOOK_SECRET=your-secure-random-string

# Application
NODE_ENV=production
PORT=8000
```

## TypeScript Features

- **Strict Type Checking**: Full type safety with strict TypeScript configuration
- **Interface Definitions**: Well-defined types for events, cache control, and API responses
- **Error Handling**: Proper error typing and type guards
- **IDE Support**: Enhanced autocomplete, refactoring, and error detection
- **Build-time Validation**: Catch errors during compilation rather than runtime

## Development Workflow

The project includes comprehensive development tools:

- **Pre-commit Hooks**: Automatically run Prettier, ESLint, and TypeScript compilation
- **Code Formatting**: Prettier with double quotes and 80-character line width
- **Linting**: ESLint with Airbnb configuration for both JS and TS files
- **Type Checking**: Strict TypeScript compilation with source maps

## Contributing

1. Follow the coding conventions in `.github/copilot-instructions.md`
2. Ensure TypeScript compilation passes: `npm run build`
3. Run linting and formatting: `npm run lint`
4. Test endpoints thoroughly
5. Update type definitions when adding new features

## License

ISC
