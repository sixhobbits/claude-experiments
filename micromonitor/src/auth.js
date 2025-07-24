const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'micromonitor-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

async function saveUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function createUser(username, password, role = 'viewer') {
    const users = await loadUsers();
    
    if (users[username]) {
        throw new Error('User already exists');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = {
        password: hashedPassword,
        role,
        createdAt: new Date().toISOString()
    };
    
    await saveUsers(users);
    return { username, role };
}

async function authenticateUser(username, password) {
    const users = await loadUsers();
    const user = users[username];
    
    if (!user) {
        throw new Error('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        throw new Error('Invalid credentials');
    }
    
    const token = jwt.sign(
        { username, role: user.role },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
    
    return { token, username, role: user.role };
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid token');
    }
}

function authMiddleware(requiredRole = null) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const token = authHeader.substring(7);
        
        try {
            const decoded = verifyToken(token);
            req.user = decoded;
            
            if (requiredRole && decoded.role !== requiredRole && decoded.role !== 'admin') {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
}

async function initializeDefaultAdmin() {
    try {
        const users = await loadUsers();
        if (Object.keys(users).length === 0) {
            await createUser('admin', 'micromonitor123', 'admin');
            console.log('Default admin user created (username: admin, password: micromonitor123)');
            console.log('IMPORTANT: Change the default password after first login!');
        }
    } catch (error) {
        console.error('Error initializing default admin:', error);
    }
}

module.exports = {
    createUser,
    authenticateUser,
    verifyToken,
    authMiddleware,
    initializeDefaultAdmin
};