<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Events API Project Instructions

This is an Express.js project for managing events. When working on this project:

## Code Style and Patterns
- Use modern JavaScript (ES6+) features where appropriate
- Follow Express.js best practices for routing and middleware
- Use async/await for asynchronous operations
- Implement proper error handling middleware
- Use descriptive variable and function names

## Project Structure
- Main application file: `app.js`
- API routes should be RESTful (GET, POST, PUT, DELETE)
- Include proper HTTP status codes in responses
- Use JSON for request/response bodies

## API Design
- All API endpoints should be under `/api/` prefix
- Include proper validation for request data
- Return consistent JSON response formats
- Include appropriate error messages

## Development
- Use nodemon for development with `npm run dev`
- Include health check endpoints for monitoring
- Log important events and errors to console
- Follow RESTful conventions for endpoint design
