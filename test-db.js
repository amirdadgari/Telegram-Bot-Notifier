#!/usr/bin/env node

/**
 * Quick database test script
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || './data/database.db';

console.log('🧪 Testing database connection...');
console.log(`📍 Database path: ${DATABASE_PATH}`);

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`✅ Created data directory: ${dataDir}`);
}

// Test database connection
const db = new sqlite3.Database(DATABASE_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Database connection successful');
});

// Test table creation and data operations
db.serialize(() => {
  console.log('🔄 Testing table operations...');
  
  // Create a test table
  db.run(`CREATE TABLE IF NOT EXISTS test_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Table creation failed:', err.message);
      process.exit(1);
    }
    console.log('✅ Test table created');
  });
  
  // Insert test data
  db.run(`INSERT INTO test_table (message) VALUES (?)`, ['Database test successful'], function(err) {
    if (err) {
      console.error('❌ Data insertion failed:', err.message);
      process.exit(1);
    }
    console.log('✅ Test data inserted');
    
    // Query test data
    db.get(`SELECT * FROM test_table WHERE id = ?`, [this.lastID], (err, row) => {
      if (err) {
        console.error('❌ Data query failed:', err.message);
        process.exit(1);
      }
      
      console.log('✅ Test data retrieved:', row);
      
      // Clean up test table
      db.run(`DROP TABLE test_table`, (err) => {
        if (err) {
          console.error('❌ Table cleanup failed:', err.message);
        } else {
          console.log('✅ Test table cleaned up');
        }
        
        db.close((err) => {
          if (err) {
            console.error('❌ Database close failed:', err.message);
          } else {
            console.log('✅ Database connection closed');
            console.log('🎉 All database tests passed!');
          }
          process.exit(0);
        });
      });
    });
  });
});
