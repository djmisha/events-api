# GraphQL Implementation Guide

This document describes the GraphQL integration into the Events API project, allowing clients to query data using GraphQL alongside the existing REST API endpoints.

## Overview

GraphQL has been integrated into the Events API to provide a flexible and efficient way to query data. The implementation coexists with the existing REST API, giving clients the choice of using either approach.

**Key Features:**
- 🎯 Precise data fetching - Request exactly what you need
- 🔒 Secured with API key authentication (same as REST API)
- 🚀 Built on Apollo Server v4 with Express integration
- 📊 Introspection enabled in development mode
- 🗄️ Uses the same Supabase database as REST API

## Architecture

### Technology Stack

- **Apollo Server v4** - GraphQL server implementation
- **graphql** - GraphQL.js for schema definition and execution
- **graphql-tag** - Template literal tag for parsing GraphQL queries
- **Express.js** - Web framework (existing)
- **Supabase** - PostgreSQL database (existing)

### Integration Approach

The GraphQL server is integrated into the existing Express.js application:
1. GraphQL endpoint is mounted at `/graphql`
2. Uses the same API key authentication middleware as REST endpoints
3. Shares the same Supabase database connection
4. Logs activities using the existing logging service

## Folder Structure

```
/events-api
├── /src
│   ├── /api                    # REST API routes (existing)
│   ├── /graphql                # GraphQL implementation (NEW)
│   │   ├── /schemas            # GraphQL type definitions
│   │   │   └── artist.js       # Artist schema
│   │   ├── /resolvers          # GraphQL resolvers
│   │   │   └── artist.js       # Artist resolvers
│   │   └── index.js            # GraphQL server setup
│   ├── /services               # Shared services (existing)
│   │   ├── supabaseClient.js   # Database client
│   │   └── logger.js           # Logging service
│   ├── /middleware             # Express middleware (existing)
│   │   └── apiKeyAuth.js       # API key authentication
│   └── server.js               # Express app (updated)
├── package.json                # Dependencies (updated)
└── GRAPHQL_IMPLEMENTATION.md   # This file
```

## Database Schema

The GraphQL implementation assumes an `artists` table in Supabase with the following schema:

```sql
CREATE TABLE artists (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient slug lookups
CREATE INDEX idx_artists_slug ON artists(slug);

-- Create index for tag searches (if using PostgreSQL GIN index)
CREATE INDEX idx_artists_tags ON artists USING GIN(tags);
```

### Sample Data

```sql
-- Insert sample artists
INSERT INTO artists (name, slug, bio, tags) VALUES
  ('Deadmau5', 'deadmau5', 'Canadian electronic music producer and performer', ARRAY['progressive house', 'electro house', 'EDM']),
  ('Tiësto', 'tiesto', 'Dutch DJ and record producer', ARRAY['trance', 'progressive house', 'big room']),
  ('Armin van Buuren', 'armin-van-buuren', 'Dutch DJ and record producer known for trance music', ARRAY['trance', 'progressive trance', 'uplifting trance']);
```

## GraphQL Schema

### Artist Type

```graphql
type Artist {
  """
  Unique identifier for the artist
  """
  id: ID!
  
  """
  Name of the artist
  """
  name: String!
  
  """
  URL-friendly slug for the artist
  """
  slug: String!
  
  """
  Biography or description of the artist
  """
  bio: String
  
  """
  Array of tags associated with the artist (genres, styles, etc.)
  """
  tags: [String]
}
```

### Queries

```graphql
type Query {
  """
  Get a single artist by their ID
  """
  artist(id: ID!): Artist
  
  """
  Get multiple artists by their IDs
  """
  artists(ids: [ID!]!): [Artist]
}
```

## API Usage

### Authentication

GraphQL endpoint uses the same authentication as REST API endpoints:

**Header:**
```
x-api-key: YOUR_API_KEY
```

**Query Parameter:**
```
?api_key=YOUR_API_KEY
```

**Bearer Token:**
```
Authorization: Bearer YOUR_API_KEY
```

### Endpoint

**Development:**
```
http://localhost:8000/graphql
```

**Production:**
```
https://your-app.vercel.app/graphql
```

### Example Queries

#### 1. Get a Single Artist by ID

**Query:**
```graphql
query GetArtist {
  artist(id: "1") {
    id
    name
    slug
    bio
    tags
  }
}
```

**cURL Request:**
```bash
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "query": "query GetArtist { artist(id: \"1\") { id name slug bio tags } }"
  }'
```

**Response:**
```json
{
  "data": {
    "artist": {
      "id": "1",
      "name": "Deadmau5",
      "slug": "deadmau5",
      "bio": "Canadian electronic music producer and performer",
      "tags": ["progressive house", "electro house", "EDM"]
    }
  }
}
```

#### 2. Get Only Specific Fields

**Query:**
```graphql
query GetArtistName {
  artist(id: "1") {
    name
    slug
  }
}
```

**Response:**
```json
{
  "data": {
    "artist": {
      "name": "Deadmau5",
      "slug": "deadmau5"
    }
  }
}
```

#### 3. Get Multiple Artists

**Query:**
```graphql
query GetMultipleArtists {
  artists(ids: ["1", "2", "3"]) {
    id
    name
    tags
  }
}
```

**cURL Request:**
```bash
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "query": "query GetMultipleArtists { artists(ids: [\"1\", \"2\", \"3\"]) { id name tags } }"
  }'
```

**Response:**
```json
{
  "data": {
    "artists": [
      {
        "id": "1",
        "name": "Deadmau5",
        "tags": ["progressive house", "electro house", "EDM"]
      },
      {
        "id": "2",
        "name": "Tiësto",
        "tags": ["trance", "progressive house", "big room"]
      },
      {
        "id": "3",
        "name": "Armin van Buuren",
        "tags": ["trance", "progressive trance", "uplifting trance"]
      }
    ]
  }
}
```

#### 4. Handle Non-Existent Artist

**Query:**
```graphql
query GetNonExistentArtist {
  artist(id: "999") {
    id
    name
  }
}
```

**Response:**
```json
{
  "data": {
    "artist": null
  }
}
```

## Development Tools

### GraphQL Playground (Development Only)

When running in development mode (`NODE_ENV=development`), you can access the GraphQL endpoint via:

1. **Using a GraphQL client tool:**
   - [Apollo Studio](https://studio.apollographql.com/sandbox)
   - [GraphQL Playground Desktop](https://github.com/graphql/graphql-playground)
   - [Postman](https://www.postman.com/) with GraphQL support

2. **Browser-based tools:**
   - Visit Apollo Studio Sandbox
   - Set endpoint to `http://localhost:8000/graphql`
   - Add header: `x-api-key: YOUR_API_KEY`

### Testing with curl

```bash
# Simple query
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"query": "{ artist(id: \"1\") { name } }"}'

# Query with variables
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "query": "query GetArtist($id: ID!) { artist(id: $id) { name bio } }",
    "variables": {"id": "1"}
  }'
```

## Error Handling

### Authentication Errors

**Missing API Key:**
```json
{
  "error": "Authentication required",
  "message": "API key is required. Provide via 'x-api-key' header, 'api_key' query parameter, or Bearer token."
}
```

**Invalid API Key:**
```json
{
  "error": "Invalid API key",
  "message": "The provided API key is not valid."
}
```

### GraphQL Errors

**Invalid Query:**
```json
{
  "errors": [
    {
      "message": "Cannot query field \"invalidField\" on type \"Artist\".",
      "locations": [{"line": 2, "column": 3}]
    }
  ]
}
```

**Database Error:**
```json
{
  "errors": [
    {
      "message": "Failed to fetch artist: Database connection error",
      "path": ["artist"]
    }
  ]
}
```

## Extending the Implementation

### Adding a New Type

1. **Create Schema** (`src/graphql/schemas/newtype.js`):
```javascript
const { gql } = require("graphql-tag");

const newTypeTypeDefs = gql`
  type NewType {
    id: ID!
    field: String!
  }
  
  extend type Query {
    newType(id: ID!): NewType
  }
`;

module.exports = newTypeTypeDefs;
```

2. **Create Resolver** (`src/graphql/resolvers/newtype.js`):
```javascript
const supabase = require("../../services/supabaseClient");

const newTypeResolvers = {
  Query: {
    newType: async (parent, { id }, context) => {
      const { data, error } = await supabase
        .from("newtypes")
        .select("*")
        .eq("id", id)
        .single();
        
      if (error) throw new Error(error.message);
      return data;
    },
  },
};

module.exports = newTypeResolvers;
```

3. **Update GraphQL Index** (`src/graphql/index.js`):
```javascript
const newTypeTypeDefs = require("./schemas/newtype");
const newTypeResolvers = require("./resolvers/newtype");

// In createGraphQLServer function:
const server = new ApolloServer({
  typeDefs: [artistTypeDefs, newTypeTypeDefs], // Add new schema
  resolvers: [artistResolvers, newTypeResolvers], // Add new resolvers
  // ... rest of config
});
```

### Adding Related Data (Relationships)

To add relationships between types (e.g., Artist → Events):

1. **Update Artist Schema**:
```graphql
type Artist {
  id: ID!
  name: String!
  events: [Event!]  # Add relationship
}

type Event {
  id: ID!
  name: String!
  date: String!
}
```

2. **Add Field Resolver**:
```javascript
const artistResolvers = {
  Artist: {
    // Field resolver for events
    events: async (parent, args, context) => {
      const { data } = await supabase
        .from("partner_events")
        .select("*")
        .contains("artistlist", [{ id: parent.id }]);
      return data || [];
    },
  },
  Query: {
    // ... existing queries
  },
};
```

## Performance Considerations

### N+1 Query Problem

When fetching related data, consider using DataLoader to batch database queries:

```javascript
const DataLoader = require("dataloader");

// Create a DataLoader for batching artist queries
const artistLoader = new DataLoader(async (ids) => {
  const { data } = await supabase
    .from("artists")
    .select("*")
    .in("id", ids);
  
  // Return in the same order as requested
  return ids.map(id => data.find(artist => artist.id === id));
});
```

### Caching

Consider implementing caching strategies:
- **Apollo Server Cache**: Built-in response caching
- **Redis**: External cache for frequently accessed data
- **Database-level**: Utilize existing cache_control table

## Deployment Considerations

### Vercel Deployment

The GraphQL implementation is serverless-compatible and works with Vercel:

1. **Environment Variables**: Same as REST API (SUPABASE_URL, SUPABASE_ANON_KEY, API_KEYS)
2. **Cold Starts**: GraphQL server initializes on first request
3. **Introspection**: Disabled in production for security

### Production Settings

```bash
# .env for production
NODE_ENV=production
API_KEYS=key1,key2,key3
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Monitoring and Logging

All GraphQL operations are logged using the existing logging service:

```javascript
// Logged events:
- "GraphQL: Fetching artist with ID: 123"
- "GraphQL: Successfully fetched artist 123"
- "GraphQL Error: ..." (for errors)
```

Monitor these logs to track:
- Query performance
- Authentication failures
- Database errors
- Usage patterns

## Best Practices

1. **Use Query Variables**: Instead of string interpolation
   ```graphql
   # Good
   query GetArtist($id: ID!) {
     artist(id: $id) { name }
   }
   
   # Avoid
   query {
     artist(id: "1") { name }
   }
   ```

2. **Request Only Needed Fields**: Avoid over-fetching
   ```graphql
   # Good - Only get what you need
   { artist(id: "1") { name slug } }
   
   # Avoid - Getting unnecessary data
   { artist(id: "1") { id name slug bio tags } }
   ```

3. **Handle Null Values**: Check for null in responses
   ```javascript
   if (data.artist) {
     // Artist exists
   } else {
     // Artist not found
   }
   ```

4. **Use Aliases for Multiple Queries**:
   ```graphql
   {
     artist1: artist(id: "1") { name }
     artist2: artist(id: "2") { name }
   }
   ```

## Troubleshooting

### GraphQL Server Not Starting

**Issue**: GraphQL endpoint returns 404

**Solution**: Check server logs for GraphQL initialization errors. Ensure all dependencies are installed:
```bash
npm install @apollo/server graphql graphql-tag
```

### Authentication Issues

**Issue**: Always getting 401 errors

**Solution**: Verify API key is set in environment variables and passed correctly:
```bash
# Check environment
echo $API_KEYS

# Test with curl
curl -H "x-api-key: YOUR_KEY" http://localhost:8000/graphql
```

### Database Connection Errors

**Issue**: "Failed to fetch artist" errors

**Solution**: Verify:
1. Supabase credentials are correct
2. `artists` table exists in database
3. Network connectivity to Supabase

## Future Enhancements

Potential additions to the GraphQL implementation:

1. **Mutations**: Add/update/delete operations
   ```graphql
   type Mutation {
     createArtist(name: String!, slug: String!): Artist
     updateArtist(id: ID!, name: String): Artist
     deleteArtist(id: ID!): Boolean
   }
   ```

2. **Subscriptions**: Real-time updates
   ```graphql
   type Subscription {
     artistUpdated(id: ID!): Artist
   }
   ```

3. **Pagination**: Cursor-based pagination for large datasets
   ```graphql
   type Query {
     artists(first: Int, after: String): ArtistConnection
   }
   ```

4. **Filtering and Sorting**: Advanced query capabilities
   ```graphql
   type Query {
     artists(
       filter: ArtistFilter
       orderBy: ArtistOrderBy
     ): [Artist]
   }
   ```

5. **DataLoader Integration**: Batch and cache database requests
6. **Rate Limiting**: Prevent abuse via complexity analysis
7. **Custom Directives**: Add custom behavior to schema
8. **Federation**: Integrate with other GraphQL services

## Resources

- [GraphQL Official Documentation](https://graphql.org/)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [Supabase with GraphQL](https://supabase.com/docs/guides/api#graphql-api)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

## Support

For issues or questions about the GraphQL implementation:
1. Check this documentation
2. Review logs for error messages
3. Test queries with GraphQL Playground
4. Verify database schema matches expectations
