const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const API_KEYS_FILE = path.join(__dirname, '..', 'data', 'apiKeys.json');

async function loadApiKeys() {
    try {
        const data = await fs.readFile(API_KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

async function saveApiKeys(apiKeys) {
    await fs.writeFile(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2));
}

function generateApiKey() {
    return `mk_${crypto.randomBytes(32).toString('hex')}`;
}

async function createApiKey(name, permissions = ['read']) {
    const apiKeys = await loadApiKeys();
    const key = generateApiKey();
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    
    apiKeys[hashedKey] = {
        name,
        permissions,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0
    };
    
    await saveApiKeys(apiKeys);
    
    return {
        key,
        name,
        permissions,
        createdAt: apiKeys[hashedKey].createdAt
    };
}

async function validateApiKey(key) {
    const apiKeys = await loadApiKeys();
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    
    const keyData = apiKeys[hashedKey];
    if (!keyData) {
        return null;
    }
    
    keyData.lastUsed = new Date().toISOString();
    keyData.usageCount++;
    await saveApiKeys(apiKeys);
    
    return {
        name: keyData.name,
        permissions: keyData.permissions
    };
}

async function listApiKeys() {
    const apiKeys = await loadApiKeys();
    return Object.entries(apiKeys).map(([hash, data]) => ({
        id: hash.substring(0, 8),
        name: data.name,
        permissions: data.permissions,
        createdAt: data.createdAt,
        lastUsed: data.lastUsed,
        usageCount: data.usageCount
    }));
}

async function deleteApiKey(keyId) {
    const apiKeys = await loadApiKeys();
    const fullHash = Object.keys(apiKeys).find(hash => hash.startsWith(keyId));
    
    if (!fullHash) {
        throw new Error('API key not found');
    }
    
    delete apiKeys[fullHash];
    await saveApiKeys(apiKeys);
    
    return true;
}

function apiKeyMiddleware() {
    return async (req, res, next) => {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return next();
        }
        
        try {
            const keyData = await validateApiKey(apiKey);
            
            if (!keyData) {
                return res.status(401).json({ error: 'Invalid API key' });
            }
            
            req.apiKey = keyData;
            req.isApiKeyAuth = true;
            next();
        } catch (error) {
            return res.status(500).json({ error: 'Error validating API key' });
        }
    };
}

function hasPermission(req, permission) {
    if (req.user) {
        if (req.user.role === 'admin') return true;
        if (permission === 'read') return true;
        if (permission === 'write' && req.user.role !== 'viewer') return true;
        return false;
    }
    
    if (req.apiKey) {
        return req.apiKey.permissions.includes(permission) || 
               req.apiKey.permissions.includes('all');
    }
    
    return false;
}

module.exports = {
    createApiKey,
    validateApiKey,
    listApiKeys,
    deleteApiKey,
    apiKeyMiddleware,
    hasPermission
};