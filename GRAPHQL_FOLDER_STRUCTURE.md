# GraphQL Folder Structure

This document provides a visual representation of the GraphQL implementation folder structure within the Events API project.

## Complete Project Structure

```
events-api/
│
├── src/
│   │
│   ├── api/                          # REST API routes
│   │   ├── events.js                 # Event endpoints
│   │   ├── health.js                 # Health check endpoint
│   │   ├── test.js                   # Test endpoints (dev only)
│   │   └── webhook.js                # Webhook endpoints
│   │
│   ├── graphql/                      # ⭐ GraphQL Implementation (NEW)
│   │   │
│   │   ├── schemas/                  # GraphQL type definitions
│   │   │   └── artist.js             # Artist type schema
│   │   │                             # Future: event.js, venue.js, etc.
│   │   │
│   │   ├── resolvers/                # GraphQL resolvers (data fetching logic)
│   │   │   └── artist.js             # Artist query resolvers
│   │   │                             # Future: event.js, venue.js, etc.
│   │   │
│   │   └── index.js                  # GraphQL server setup & configuration
│   │                                 # - Apollo Server initialization
│   │                                 # - Schema & resolver registration
│   │                                 # - Middleware export
│   │
│   ├── jobs/                         # Background jobs
│   │   ├── cleanup.js                # Database cleanup job
│   │   ├── fetchData.js              # Data fetching utilities
│   │   └── fetchPartnerData.js       # Partner data fetching
│   │
│   ├── middleware/                   # Express middleware
│   │   └── apiKeyAuth.js             # API key authentication (shared by REST & GraphQL)
│   │
│   ├── services/                     # Shared services
│   │   ├── backgroundJobs.js         # Background job management
│   │   ├── cacheControl.js           # Cache management
│   │   ├── edmTrain.js               # EDM Train API client
│   │   ├── logger.js                 # Logging service (shared by REST & GraphQL)
│   │   ├── supabaseClient.js         # Supabase DB client (shared by REST & GraphQL)
│   │   └── ticketmaster.js           # Ticketmaster API client
│   │
│   ├── utils/                        # Utility functions
│   │   ├── transform.js              # Data transformation
│   │   └── validate.js               # Data validation
│   │
│   └── server.js                     # ⭐ Express app entry point (UPDATED)
│                                     # - Mounts GraphQL endpoint at /graphql
│                                     # - Initializes Apollo Server
│
├── .github/                          # GitHub configuration
│   └── copilot-instructions.md       # Copilot instructions
│
├── .gitignore                        # Git ignore rules
├── .vscode/                          # VS Code settings
├── package.json                      # ⭐ Dependencies (UPDATED)
│                                     # - Added @apollo/server
│                                     # - Added graphql
│                                     # - Added graphql-tag
├── package-lock.json                 # ⭐ Lock file (UPDATED)
├── vercel.json                       # Vercel deployment config
├── README.md                         # ⭐ Main documentation (UPDATED)
├── GRAPHQL_IMPLEMENTATION.md         # ⭐ GraphQL implementation guide (NEW)
├── GRAPHQL_FOLDER_STRUCTURE.md       # ⭐ This file (NEW)
└── technical_design.md               # Technical design document
```

## GraphQL Directory Breakdown

### `/src/graphql/` - Main GraphQL Directory

The central location for all GraphQL-related code.

```
src/graphql/
│
├── schemas/              # Type definitions (GraphQL SDL)
│   └── artist.js         # Artist type, queries
│
├── resolvers/            # Resolver functions (data fetching)
│   └── artist.js         # Artist query implementations
│
└── index.js              # GraphQL server configuration
```

#### `schemas/` - Type Definitions

**Purpose:** Define GraphQL types, queries, mutations, and subscriptions using GraphQL Schema Definition Language (SDL).

**Current Files:**
- `artist.js` - Defines Artist type and related queries

**File Structure Example:**
```javascript
// schemas/artist.js
const { gql } = require("graphql-tag");

const artistTypeDefs = gql`
  type Artist {
    id: ID!
    name: String!
    slug: String!
    bio: String
    tags: [String]
  }

  type Query {
    artist(id: ID!): Artist
    artists(ids: [ID!]!): [Artist]
  }
`;

module.exports = artistTypeDefs;
```

**Future Extensions:**
```
schemas/
├── artist.js        # Existing
├── event.js         # Event type (future)
├── venue.js         # Venue type (future)
└── index.js         # Schema aggregator (future)
```

#### `resolvers/` - Resolver Functions

**Purpose:** Implement the logic to fetch data for each GraphQL field.

**Current Files:**
- `artist.js` - Implements artist and artists queries

**File Structure Example:**
```javascript
// resolvers/artist.js
const supabase = require("../../services/supabaseClient");
const logger = require("../../services/logger");

const artistResolvers = {
  Query: {
    artist: async (parent, { id }, context) => {
      // Fetch artist from database
      const { data, error } = await supabase
        .from("artists")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    },
    
    artists: async (parent, { ids }, context) => {
      // Fetch multiple artists
      const { data, error } = await supabase
        .from("artists")
        .select("*")
        .in("id", ids);
      
      if (error) throw new Error(error.message);
      return data || [];
    },
  },
};

module.exports = artistResolvers;
```

**Future Extensions:**
```
resolvers/
├── artist.js        # Existing
├── event.js         # Event resolvers (future)
├── venue.js         # Venue resolvers (future)
└── index.js         # Resolver aggregator (future)
```

#### `index.js` - GraphQL Server Configuration

**Purpose:** Set up Apollo Server with schemas, resolvers, and configuration.

**Responsibilities:**
1. Import all schemas and resolvers
2. Create Apollo Server instance
3. Configure plugins and error handling
4. Export middleware for Express integration

**File Structure:**
```javascript
// graphql/index.js
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const artistTypeDefs = require("./schemas/artist");
const artistResolvers = require("./resolvers/artist");

async function createGraphQLServer() {
  const server = new ApolloServer({
    typeDefs: [artistTypeDefs],
    resolvers: [artistResolvers],
    // ... configuration
  });

  await server.start();
  return server;
}

function getGraphQLMiddleware(server) {
  return expressMiddleware(server, {
    context: async ({ req }) => ({ req }),
  });
}

module.exports = {
  createGraphQLServer,
  getGraphQLMiddleware,
};
```

## Integration Points

### How GraphQL Connects to Existing Code

```
┌─────────────────────────────────────────────────────────────┐
│                          server.js                          │
│                  (Express Application)                      │
└──────────┬──────────────────────────────────────────────────┘
           │
           ├──→ /api/v1/events     (REST API - existing)
           ├──→ /api/webhook       (Webhooks - existing)
           ├──→ /health            (Health check - existing)
           │
           └──→ /graphql           (GraphQL - NEW)
                   │
                   ├──→ apiKeyAuth middleware (shared)
                   │       │
                   │       └──→ Validates API key
                   │
                   └──→ GraphQL Server
                           │
                           ├──→ Schemas (Type definitions)
                           │
                           ├──→ Resolvers (Query logic)
                           │       │
                           │       └──→ supabaseClient (shared)
                           │       └──→ logger (shared)
                           │
                           └──→ Context (Request data)
```

## Shared Resources

GraphQL uses the same infrastructure as REST API:

```
Shared Services:
├── supabaseClient.js    # Database connection (used by both REST & GraphQL)
├── logger.js            # Logging service (used by both REST & GraphQL)
└── apiKeyAuth.js        # Authentication (used by both REST & GraphQL)
```

## File Relationships

```
GraphQL Request Flow:

1. Client → POST /graphql
   │
2. server.js → apiKeyAuth middleware
   │
3. GraphQL Server → Parse query
   │
4. Resolvers → Fetch data
   │   │
   │   ├─→ supabaseClient (services/)
   │   └─→ logger (services/)
   │
5. Response → JSON to client
```

## Adding New Types

To add a new GraphQL type (e.g., Event):

### Step 1: Create Schema

```bash
# Create new schema file
touch src/graphql/schemas/event.js
```

```javascript
// src/graphql/schemas/event.js
const { gql } = require("graphql-tag");

const eventTypeDefs = gql`
  type Event {
    id: ID!
    name: String!
    date: String!
    venue: String
  }
  
  extend type Query {
    event(id: ID!): Event
    events: [Event]
  }
`;

module.exports = eventTypeDefs;
```

### Step 2: Create Resolver

```bash
# Create new resolver file
touch src/graphql/resolvers/event.js
```

```javascript
// src/graphql/resolvers/event.js
const supabase = require("../../services/supabaseClient");

const eventResolvers = {
  Query: {
    event: async (parent, { id }, context) => {
      const { data, error } = await supabase
        .from("partner_events")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    },
    
    events: async (parent, args, context) => {
      const { data, error } = await supabase
        .from("partner_events")
        .select("*")
        .limit(100);
      
      if (error) throw new Error(error.message);
      return data || [];
    },
  },
};

module.exports = eventResolvers;
```

### Step 3: Register in GraphQL Server

```javascript
// src/graphql/index.js
const artistTypeDefs = require("./schemas/artist");
const eventTypeDefs = require("./schemas/event");      // Add import

const artistResolvers = require("./resolvers/artist");
const eventResolvers = require("./resolvers/event");   // Add import

async function createGraphQLServer() {
  const server = new ApolloServer({
    typeDefs: [artistTypeDefs, eventTypeDefs],         // Add to array
    resolvers: [artistResolvers, eventResolvers],      // Add to array
    // ... rest of config
  });
  
  await server.start();
  return server;
}
```

## Summary

The GraphQL implementation follows a modular, scalable structure:

- **Centralized**: All GraphQL code in `/src/graphql/`
- **Organized**: Separate directories for schemas and resolvers
- **Extensible**: Easy to add new types and queries
- **Integrated**: Shares services with existing REST API
- **Authenticated**: Uses existing API key middleware
- **Documented**: Clear file purposes and relationships

This structure allows the GraphQL API to grow alongside the REST API while maintaining code organization and reusability.
