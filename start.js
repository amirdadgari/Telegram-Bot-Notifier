#!/usr/bin/env node

/**
 * Startup script with enhanced error handling and database initialization
 */

const fs = require('fs');
const path = require('path');

// Environment setup
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_PATH = process.env.DATABASE_PATH || './data/database.db';

console.log('🚀 Starting Webhook to Telegram Bot...');
console.log(`📦 Environment: ${NODE_ENV}`);
console.log(`💾 Database: ${DATABASE_PATH}`);

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`✅ Created data directory: ${dataDir}`);
  }
  
  // Check if we can write to the data directory (skip in Docker if handled by entrypoint)
  const testFile = path.join(dataDir, '.write-test');
  try {
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`✅ Data directory is writable: ${dataDir}`);
  } catch (writeError) {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/.dockerenv')) {
      console.log(`⚠️  Write test failed (handled by Docker entrypoint): ${dataDir}`);
    } else {
      throw writeError;
    }
  }
  
} catch (error) {
  console.error(`❌ Error setting up data directory: ${error.message}`);
  process.exit(1);
}

// Check required environment variables
const requiredEnvVars = {
  'SESSION_SECRET': process.env.SESSION_SECRET,
  'PORT': process.env.PORT || '3000'
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  if (NODE_ENV === 'production') {
    console.error('❌ Required environment variables missing in production mode');
    process.exit(1);
  }
}

// Log startup info
console.log(`🌐 Server will start on port: ${process.env.PORT || 3000}`);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the main application
try {
  require('./app.js');
} catch (error) {
  console.error('❌ Failed to start application:', error.message);
  console.error(error.stack);
  process.exit(1);
}
