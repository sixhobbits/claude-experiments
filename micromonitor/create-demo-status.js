const DataStore = require('./src/dataStore');
const dataStore = new DataStore();

async function createDemoStatusPage() {
    const statusId = await dataStore.createStatusPage({
        name: 'MicroMonitor Demo Service',
        description: 'Real-time monitoring of MicroMonitor\'s own infrastructure',
        isPublic: true,
        userId: 'demo',
        createdAt: new Date().toISOString()
    });
    
    console.log('Demo status page created successfully!');
    console.log('Status ID:', statusId);
    console.log('Public URL:', `https://claude.dwyer.co.za/status/${statusId}`);
    console.log('Badge URL:', `https://claude.dwyer.co.za/api/badge/${statusId}`);
}

createDemoStatusPage().catch(console.error);