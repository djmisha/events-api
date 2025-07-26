const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Events API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      events: '/api/events'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api/events', (req, res) => {
  res.json({
    events: [
      {
        id: 1,
        title: 'Sample Event',
        description: 'This is a sample event',
        date: '2025-08-01',
        location: 'Sample Location'
      }
    ]
  });
});

app.post('/api/events', (req, res) => {
  const { title, description, date, location } = req.body;
  
  if (!title || !date) {
    return res.status(400).json({
      error: 'Title and date are required'
    });
  }
  
  const newEvent = {
    id: Date.now(),
    title,
    description,
    date,
    location
  };
  
  res.status(201).json({
    message: 'Event created successfully',
    event: newEvent
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!'
  });
});

app.listen(port, () => {
  console.log(`Events API server running on port ${port}`);
  console.log(`Visit http://localhost:${port} to get started`);
});

module.exports = app;
