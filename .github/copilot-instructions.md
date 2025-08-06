<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Events API Project Instructions

This is an Express.js project for managing events with serverless-compatible architecture. When working on this project:

## Code Style and Patterns

- Use modern JavaScript (ES6+) features where appropriate
- Follow Express.js best practices for routing and middleware
- Use async/await for asynchronous operations
- Implement proper error handling middleware
- Use descriptive variable and function names

## Project Structure

- Main application file: `src/server.js`
- API routes should be RESTful (GET, POST, PUT, DELETE)
- Include proper HTTP status codes in responses
- Use JSON for request/response bodies

## API Design

- All API endpoints should be under `/api/` prefix
- Main endpoint: `/api/v1/events/:id/:city` (path parameters)
- Include proper validation for request data
- Return consistent JSON response formats
- Include appropriate error messages

## Architecture

- **Serverless-ready**: No server-side state or memory dependencies
- **Database-driven cache**: Use Supabase `cache_control` table for TTL management
- **Webhook-based background jobs**: Use `/api/webhook/fetch-partner-data` for async processing
- **Environment detection**: Direct execution in dev, webhook calls in production

## Development

- Use nodemon for development with `npm run dev`
- Include health check endpoints for monitoring
- Log important events and errors to console
- Follow RESTful conventions for endpoint design
- Test endpoints work in both development and production modes
