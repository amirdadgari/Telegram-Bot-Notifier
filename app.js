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
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Database setup
const db = new sqlite3.Database('./database.db');

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
  db.all(
    "SELECT * FROM tokens WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, tokens) => {
      if (err) {
        return res.render('tokens', { tokens: [], error: 'Database error' });
      }
      res.render('tokens', { tokens, error: null });
    }
  );
});

app.post('/tokens', requireAuth, (req, res) => {
  const { name } = req.body;
  const token = uuidv4();
  
  db.run(
    "INSERT INTO tokens (user_id, token, name) VALUES (?, ?, ?)",
    [req.session.userId, token, name],
    (err) => {
      if (err) {
        return res.redirect('/tokens?error=Error creating token');
      }
      res.redirect('/tokens');
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

// Telegram bots page
app.get('/bots', requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM telegram_bots WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, bots) => {
      if (err) {
        return res.render('bots', { bots: [], error: 'Database error' });
      }
      res.render('bots', { bots, error: null });
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
      return res.render('users', { users: [], error: 'Database error' });
    }
    res.render('users', { users, error: null });
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
        
        // Get user's telegram bots
        db.all(
          "SELECT * FROM telegram_bots WHERE user_id = ? AND is_active = 1",
          [tokenData.user_id],
          async (err, bots) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (bots.length === 0) {
              return res.status(400).json({ error: 'No active Telegram bots configured' });
            }
            
            // Send message to all user's bots
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
