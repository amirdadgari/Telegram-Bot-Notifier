const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files with proper MIME types
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    }
  }
}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Database setup
const fs = require('fs');
const DATABASE_PATH = process.env.DATABASE_PATH || './data/database.db';

// Ensure data directory exists
const dataDir = require('path').dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Created data directory: ${dataDir}`);
}

const db = new sqlite3.Database(DATABASE_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite database at ${DATABASE_PATH}`);
});

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    password_changed BOOLEAN DEFAULT 0
  )`);

  // Tokens table
  db.run(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    send_to_all BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Telegram bots table
  db.run(`CREATE TABLE IF NOT EXISTS telegram_bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    bot_token VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    bot_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Token-Bot assignments table
  db.run(`CREATE TABLE IF NOT EXISTS token_bot_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER,
    bot_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens (id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES telegram_bots (id) ON DELETE CASCADE,
    UNIQUE(token_id, bot_id)
  )`);

  // Add send_to_all column to existing tokens table if it doesn't exist
  db.run(`ALTER TABLE tokens ADD COLUMN send_to_all BOOLEAN DEFAULT 0`, (err) => {
    // Ignore error if column already exists
  });

  // Create admin user if not exists
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (err) {
      console.error('Error checking admin user:', err);
      return;
    }
    
    if (!row) {
      const hashedPassword = bcrypt.hashSync('changeme', 10);
      db.run(
        "INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)",
        ['admin', hashedPassword, 1],
        function(err) {
          if (err) {
            console.error('Error creating admin user:', err);
          } else {
            console.log('Admin user created with username: admin, password: changeme');
            console.log('Please change the password after first login!');
          }
        }
      );
    }
  });
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Home page - redirect to dashboard if logged in, otherwise to login
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      return res.render('login', { error: 'Database error' });
    }
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.render('login', { error: 'Invalid username or password' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin;
    
    // Check if password needs to be changed (for admin first login)
    if (user.username === 'admin' && !user.password_changed) {
      return res.redirect('/change-password?force=true');
    }
    
    res.redirect('/dashboard');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Dashboard
app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { 
    username: req.session.username,
    isAdmin: req.session.isAdmin 
  });
});

// Change password page
app.get('/change-password', requireAuth, (req, res) => {
  const force = req.query.force === 'true';
  res.render('change-password', { error: null, force });
});

app.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const force = req.body.force === 'true';
  
  if (newPassword !== confirmPassword) {
    return res.render('change-password', { 
      error: 'New passwords do not match',
      force 
    });
  }
  
  if (newPassword.length < 6) {
    return res.render('change-password', { 
      error: 'Password must be at least 6 characters long',
      force 
    });
  }
  
  db.get("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err) {
      return res.render('change-password', { 
        error: 'Database error',
        force 
      });
    }
    
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.render('change-password', { 
        error: 'Current password is incorrect',
        force 
      });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run(
      "UPDATE users SET password = ?, password_changed = 1 WHERE id = ?",
      [hashedPassword, req.session.userId],
      (err) => {
        if (err) {
          return res.render('change-password', { 
            error: 'Error updating password',
            force 
          });
        }
        
        res.redirect('/dashboard?message=Password changed successfully');
      }
    );
  });
});

// Tokens page
app.get('/tokens', requireAuth, (req, res) => {
  // Get all tokens for the user
  db.all(
    "SELECT * FROM tokens WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, tokens) => {
      if (err) {
        return res.render('tokens', { 
          tokens: [], 
          bots: [],
          error: 'Database error',
          username: req.session.username,
          isAdmin: req.session.isAdmin
        });
      }
      
      // Get all bots for the user
      db.all(
        "SELECT * FROM telegram_bots WHERE user_id = ? AND is_active = 1 ORDER BY bot_name",
        [req.session.userId],
        (err, bots) => {
          if (err) {
            return res.render('tokens', { 
              tokens: [], 
              bots: [],
              error: 'Database error',
              username: req.session.username,
              isAdmin: req.session.isAdmin
            });
          }
          
          // Get bot assignments for each token
          const tokenPromises = tokens.map(token => {
            return new Promise((resolve) => {
              db.all(
                "SELECT tb.* FROM telegram_bots tb JOIN token_bot_assignments tba ON tb.id = tba.bot_id WHERE tba.token_id = ?",
                [token.id],
                (err, assignedBots) => {
                  token.assignedBots = err ? [] : assignedBots;
                  resolve(token);
                }
              );
            });
          });
          
          Promise.all(tokenPromises).then(tokensWithBots => {
            res.render('tokens', { 
              tokens: tokensWithBots, 
              bots,
              error: req.query.error || null,
              username: req.session.username,
              isAdmin: req.session.isAdmin
            });
          });
        }
      );
    }
  );
});

app.post('/tokens', requireAuth, (req, res) => {
  const { name, sendToAll, botIds } = req.body;
  const token = uuidv4();
  
  db.run(
    "INSERT INTO tokens (user_id, token, name, send_to_all) VALUES (?, ?, ?, ?)",
    [req.session.userId, token, name, sendToAll ? 1 : 0],
    function(err) {
      if (err) {
        return res.redirect('/tokens?error=Error creating token');
      }
      
      const tokenId = this.lastID;
      
      // If not send_to_all, assign specific bots
      if (!sendToAll && botIds && Array.isArray(botIds)) {
        const assignments = botIds.map(botId => {
          return new Promise((resolve) => {
            db.run(
              "INSERT INTO token_bot_assignments (token_id, bot_id) VALUES (?, ?)",
              [tokenId, botId],
              (err) => resolve()
            );
          });
        });
        
        Promise.all(assignments).then(() => {
          res.redirect('/tokens');
        });
      } else {
        res.redirect('/tokens');
      }
    }
  );
});

app.post('/tokens/:id/delete', requireAuth, (req, res) => {
  db.run(
    "DELETE FROM tokens WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.userId],
    (err) => {
      if (err) {
        return res.redirect('/tokens?error=Error deleting token');
      }
      res.redirect('/tokens');
    }
  );
});

// Get token for editing
app.get('/tokens/:id/edit', requireAuth, (req, res) => {
  db.get(
    "SELECT * FROM tokens WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.userId],
    (err, token) => {
      if (err || !token) {
        return res.status(404).json({ error: 'Token not found' });
      }
      
      // Get assigned bots
      db.all(
        "SELECT bot_id FROM token_bot_assignments WHERE token_id = ?",
        [token.id],
        (err, assignments) => {
          const assignedBotIds = err ? [] : assignments.map(a => a.bot_id);
          res.json({ 
            ...token, 
            assignedBotIds 
          });
        }
      );
    }
  );
});

// Update token bot assignments
app.post('/tokens/:id/edit', requireAuth, (req, res) => {
  const { name, sendToAll, botIds } = req.body;
  
  db.run(
    "UPDATE tokens SET name = ?, send_to_all = ? WHERE id = ? AND user_id = ?",
    [name, sendToAll ? 1 : 0, req.params.id, req.session.userId],
    (err) => {
      if (err) {
        return res.json({ success: false, error: 'Error updating token' });
      }
      
      // Clear existing assignments
      db.run(
        "DELETE FROM token_bot_assignments WHERE token_id = ?",
        [req.params.id],
        (err) => {
          if (err) {
            return res.json({ success: false, error: 'Error updating assignments' });
          }
          
          // Add new assignments if not send_to_all
          if (!sendToAll && botIds && Array.isArray(botIds)) {
            const assignments = botIds.map(botId => {
              return new Promise((resolve) => {
                db.run(
                  "INSERT INTO token_bot_assignments (token_id, bot_id) VALUES (?, ?)",
                  [req.params.id, botId],
                  (err) => resolve()
                );
              });
            });
            
            Promise.all(assignments).then(() => {
              res.json({ success: true });
            });
          } else {
            res.json({ success: true });
          }
        }
      );
    }
  );
});

// Test token by sending message to assigned bots
app.post('/tokens/:id/test', requireAuth, (req, res) => {
  db.get(
    "SELECT * FROM tokens WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.userId],
    (err, token) => {
      if (err || !token) {
        return res.json({ success: false, error: 'Token not found' });
      }
      
      let botQuery;
      let botParams;
      
      if (token.send_to_all) {
        // Send to all active bots
        botQuery = "SELECT * FROM telegram_bots WHERE user_id = ? AND is_active = 1";
        botParams = [req.session.userId];
      } else {
        // Send to assigned bots only
        botQuery = `
          SELECT tb.* FROM telegram_bots tb 
          JOIN token_bot_assignments tba ON tb.id = tba.bot_id 
          WHERE tba.token_id = ? AND tb.is_active = 1
        `;
        botParams = [token.id];
      }
      
      db.all(botQuery, botParams, async (err, bots) => {
        if (err) {
          return res.json({ success: false, error: 'Database error' });
        }
        
        if (bots.length === 0) {
          return res.json({ success: false, error: 'No bots assigned to this token' });
        }
        
        const testMessage = `🧪 Test message from token "${token.name}"\n\n⏰ Sent at: ${new Date().toLocaleString()}`;
        const results = [];
        
        for (const bot of bots) {
          try {
            const response = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: bot.chat_id,
                text: testMessage
              })
            });
            
            const result = await response.json();
            
            if (response.ok) {
              results.push({ botName: bot.bot_name || `Bot ${bot.id}`, success: true });
            } else {
              results.push({ 
                botName: bot.bot_name || `Bot ${bot.id}`, 
                success: false, 
                error: result.description || 'Unknown error' 
              });
            }
          } catch (error) {
            results.push({ 
              botName: bot.bot_name || `Bot ${bot.id}`, 
              success: false, 
              error: error.message 
            });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        res.json({ 
          success: successCount > 0, 
          results,
          message: `Test completed: ${successCount}/${results.length} bots sent successfully`
        });
      });
    }
  );
});

// Telegram bots page
app.get('/bots', requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM telegram_bots WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, bots) => {
      if (err) {
        return res.render('bots', { 
          bots: [], 
          error: 'Database error',
          username: req.session.username,
          isAdmin: req.session.isAdmin
        });
      }
      res.render('bots', { 
        bots, 
        error: null,
        username: req.session.username,
        isAdmin: req.session.isAdmin
      });
    }
  );
});

app.post('/bots', requireAuth, (req, res) => {
  const { bot_name, bot_token, chat_id } = req.body;
  
  db.run(
    "INSERT INTO telegram_bots (user_id, bot_token, chat_id, bot_name) VALUES (?, ?, ?, ?)",
    [req.session.userId, bot_token, chat_id, bot_name],
    (err) => {
      if (err) {
        return res.redirect('/bots?error=Error creating bot');
      }
      res.redirect('/bots');
    }
  );
});

// Get bot data for editing
app.get('/bots/:id/edit', requireAuth, (req, res) => {
  db.get(
    "SELECT * FROM telegram_bots WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.userId],
    (err, bot) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      res.json(bot);
    }
  );
});

// Update bot
app.post('/bots/:id/edit', requireAuth, (req, res) => {
  const { bot_name, bot_token, chat_id } = req.body;
  
  db.run(
    "UPDATE telegram_bots SET bot_name = ?, bot_token = ?, chat_id = ? WHERE id = ? AND user_id = ?",
    [bot_name, bot_token, chat_id, req.params.id, req.session.userId],
    (err) => {
      if (err) {
        return res.redirect('/bots?error=Error updating bot');
      }
      res.redirect('/bots');
    }
  );
});

// Test bot configuration
app.post('/bots/test', requireAuth, async (req, res) => {
  const { bot_token, chat_id } = req.body;
  
  if (!bot_token || !chat_id) {
    return res.status(400).json({ error: 'Bot token and chat ID are required' });
  }
  
  try {
    const telegramUrl = `https://api.telegram.org/bot${bot_token}/sendMessage`;
    const testMessage = '🧪 Test message from Telegram Bot Notifier!';
    
    const response = await axios.post(telegramUrl, {
      chat_id: chat_id,
      text: testMessage,
      parse_mode: 'HTML'
    });
    
    res.json({
      success: true,
      message: 'Test message sent successfully!',
      message_id: response.data.result.message_id
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.response?.data?.description || error.message
    });
  }
});

app.post('/bots/:id/delete', requireAuth, (req, res) => {
  db.run(
    "DELETE FROM telegram_bots WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.userId],
    (err) => {
      if (err) {
        return res.redirect('/bots?error=Error deleting bot');
      }
      res.redirect('/bots');
    }
  );
});

// Users page (admin only)
app.get('/users', requireAuth, requireAdmin, (req, res) => {
  db.all("SELECT id, username, is_admin, created_at FROM users", (err, users) => {
    if (err) {
      return res.render('users', { 
        users: [], 
        error: 'Database error',
        username: req.session.username,
        isAdmin: req.session.isAdmin
      });
    }
    res.render('users', { 
      users, 
      error: null,
      username: req.session.username,
      isAdmin: req.session.isAdmin
    });
  });
});

app.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, is_admin } = req.body;
  
  if (password.length < 6) {
    return res.redirect('/users?error=Password must be at least 6 characters long');
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    "INSERT INTO users (username, password, is_admin, password_changed) VALUES (?, ?, ?, ?)",
    [username, hashedPassword, is_admin === 'on' ? 1 : 0, 1],
    (err) => {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.redirect('/users?error=Username already exists');
        }
        return res.redirect('/users?error=Error creating user');
      }
      res.redirect('/users');
    }
  );
});

app.post('/users/:id/delete', requireAuth, requireAdmin, (req, res) => {
  const userId = req.params.id;
  
  // Prevent deleting the current user
  if (parseInt(userId) === req.session.userId) {
    return res.redirect('/users?error=Cannot delete your own account');
  }
  
  db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
    if (err) {
      return res.redirect('/users?error=Error deleting user');
    }
    res.redirect('/users');
  });
});

// API endpoint to send messages
app.post('/api/send', async (req, res) => {
  const { message } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    // Verify token and get user
    db.get(
      `SELECT t.*, u.id as user_id FROM tokens t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.token = ? AND t.is_active = 1`,
      [token],
      async (err, tokenData) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!tokenData) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        // Get bots based on token assignment
        let botQuery;
        let botParams;
        
        if (tokenData.send_to_all) {
          // Send to all active bots
          botQuery = "SELECT * FROM telegram_bots WHERE user_id = ? AND is_active = 1";
          botParams = [tokenData.user_id];
        } else {
          // Send to assigned bots only
          botQuery = `
            SELECT tb.* FROM telegram_bots tb 
            JOIN token_bot_assignments tba ON tb.id = tba.bot_id 
            WHERE tba.token_id = ? AND tb.is_active = 1
          `;
          botParams = [tokenData.id];
        }
        
        db.all(botQuery, botParams, async (err, bots) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (bots.length === 0) {
              return res.status(400).json({ error: 'No bots assigned to this token or no active bots available' });
            }
            
            // Send message to assigned bots
            const results = [];
            for (const bot of bots) {
              try {
                const telegramUrl = `https://api.telegram.org/bot${bot.bot_token}/sendMessage`;
                const response = await axios.post(telegramUrl, {
                  chat_id: bot.chat_id,
                  text: message,
                  parse_mode: 'HTML'
                });
                
                results.push({
                  bot_name: bot.bot_name,
                  success: true,
                  message_id: response.data.result.message_id
                });
              } catch (error) {
                results.push({
                  bot_name: bot.bot_name,
                  success: false,
                  error: error.response?.data?.description || error.message
                });
              }
            }
            
            res.json({
              success: true,
              message: 'Message sending completed',
              results
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get user info (for testing)
app.get('/api/user', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  
  db.get(
    `SELECT t.name as token_name, u.username FROM tokens t 
     JOIN users u ON t.user_id = u.id 
     WHERE t.token = ? AND t.is_active = 1`,
    [token],
    (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!data) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      res.json(data);
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});
