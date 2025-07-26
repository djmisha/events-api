# Events API

A simple Express.js API for managing events built with Node.js and Express.

## Features

- RESTful API endpoints for events management
- JSON request/response handling
- Health check endpoint
- Error handling middleware
- Development server with auto-reload

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

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

The server will start on port 3001 by default. You can set a different port using the `PORT` environment variable:
```bash
PORT=8080 npm start
```

## API Endpoints

### Base URL
`http://localhost:3001`

### Endpoints

- **GET /** - Welcome message with API information
- **GET /health** - Health check endpoint
- **GET /api/events** - Get all events
- **POST /api/events** - Create a new event

### Example Usage

#### Get all events
```bash
curl http://localhost:3001/api/events
```

#### Create a new event
```bash
curl -X POST http://localhost:3001/api/events \
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
