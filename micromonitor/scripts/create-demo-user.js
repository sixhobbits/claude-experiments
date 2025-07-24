#!/usr/bin/env node
const path = require('path');
const { createUser } = require('../src/auth');

async function createDemoUser() {
    try {
        const result = await createUser('demo', 'demo123', 'viewer');
        console.log('Demo user created successfully:', result);
    } catch (error) {
        if (error.message === 'User already exists') {
            console.log('Demo user already exists');
        } else {
            console.error('Error creating demo user:', error.message);
        }
    }
}

createDemoUser().then(() => process.exit(0)).catch(() => process.exit(1));