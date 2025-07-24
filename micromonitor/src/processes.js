const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ProcessMonitor {
    constructor() {
        this.topProcessesCount = 10; // Number of top processes to track
    }

    async getProcessStats() {
        try {
            // Get detailed process information using ps command
            const psCommand = 'ps aux --sort=-%cpu | head -n 20';
            const { stdout: psOutput } = await execPromise(psCommand);
            
            // Parse ps output
            const processes = this.parsePsOutput(psOutput);
            
            // Get process count by state
            const { stdout: stateOutput } = await execPromise('ps aux | awk \'{print $8}\' | sort | uniq -c');
            const processCounts = this.parseProcessCounts(stateOutput);
            
            // Get total process count
            const { stdout: totalCount } = await execPromise('ps aux | wc -l');
            const totalProcesses = parseInt(totalCount.trim()) - 1; // Subtract header line
            
            return {
                timestamp: new Date().toISOString(),
                totalProcesses,
                processCounts,
                topProcessesByCpu: processes.slice(0, this.topProcessesCount),
                topProcessesByMemory: [...processes].sort((a, b) => b.memory - a.memory).slice(0, this.topProcessesCount)
            };
        } catch (error) {
            console.error('Error getting process stats:', error);
            return {
                timestamp: new Date().toISOString(),
                error: error.message,
                totalProcesses: 0,
                processCounts: {},
                topProcessesByCpu: [],
                topProcessesByMemory: []
            };
        }
    }

    parsePsOutput(output) {
        const lines = output.trim().split('\n');
        const header = lines[0];
        const processes = [];
        
        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 11) {
                processes.push({
                    user: parts[0],
                    pid: parseInt(parts[1]),
                    cpu: parseFloat(parts[2]),
                    memory: parseFloat(parts[3]),
                    vsz: parseInt(parts[4]),
                    rss: parseInt(parts[5]),
                    tty: parts[6],
                    state: parts[7],
                    start: parts[8],
                    time: parts[9],
                    command: parts.slice(10).join(' ').substring(0, 100) // Limit command length
                });
            }
        }
        
        return processes;
    }

    parseProcessCounts(output) {
        const counts = {};
        const lines = output.trim().split('\n');
        
        const stateDescriptions = {
            'R': 'Running',
            'S': 'Sleeping',
            'D': 'Disk sleep',
            'Z': 'Zombie',
            'T': 'Stopped',
            'I': 'Idle'
        };
        
        lines.forEach(line => {
            const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
            if (match) {
                const count = parseInt(match[1]);
                const state = match[2].charAt(0); // Get first character of state
                const description = stateDescriptions[state] || state;
                counts[description] = count;
            }
        });
        
        return counts;
    }

    async getSpecificProcess(processName) {
        try {
            const command = `ps aux | grep -v grep | grep -i "${processName}"`;
            const { stdout } = await execPromise(command);
            
            if (!stdout.trim()) {
                return { found: false, processName };
            }
            
            const processes = this.parsePsOutput('USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND\n' + stdout);
            return {
                found: true,
                processName,
                instances: processes
            };
        } catch (error) {
            return { found: false, processName, error: error.message };
        }
    }

    async checkCriticalProcesses(criticalProcesses = []) {
        const results = {};
        
        for (const processName of criticalProcesses) {
            const processInfo = await this.getSpecificProcess(processName);
            results[processName] = {
                running: processInfo.found,
                instances: processInfo.instances ? processInfo.instances.length : 0,
                details: processInfo.instances || []
            };
        }
        
        return results;
    }
}

module.exports = ProcessMonitor;