const axios = require('axios');
const io = require('socket.io-client');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');

const argv = yargs(hideBin(process.argv))
    .option('users', {
        alias: 'u',
        type: 'number',
        description: 'Number of concurrent users',
        default: 10
    })
    .option('duration', {
        alias: 'd',
        type: 'number',
        description: 'Test duration in seconds',
        default: 60
    })
    .option('gateway', {
        alias: 'g',
        type: 'string',
        description: 'Gateway URL',
        default: 'http://localhost:3000'
    })
    .option('bet-interval', {
        alias: 'i',
        type: 'number',
        description: 'Bet interval in ms (min)',
        default: 1000
    })
    .option('bet-interval-max', {
        type: 'number',
        description: 'Bet interval in ms (max)',
        default: 5000
    })
    .argv;

const GATEWAY_URL = argv.gateway;
const WS_URL = argv.gateway;
const NUM_USERS = argv.users;
const DURATION_SECONDS = argv.duration;
const BET_INTERVAL_MIN = argv['bet-interval'];
const BET_INTERVAL_MAX = argv['bet-interval-max'];

// Stats tracking
const stats = {
    totalBets: 0,
    successfulBets: 0,
    failedBets: 0,
    insufficientBalance: 0,
    balanceUpdates: 0,
    errors: {},
    startTime: null,
    endTime: null
};

// Generate test user IDs
function generateUserId(index) {
    const base = '550e8400-e29b-41d4-a716-4466554400';
    return `${base}${String(index).padStart(2, '0')}`;
}

// Random bet amount between 10 and 100
function randomBetAmount() {
    return Math.floor(Math.random() * 91) + 10;
}

// Random interval between min and max
function randomInterval() {
    return Math.floor(Math.random() * (BET_INTERVAL_MAX - BET_INTERVAL_MIN + 1)) + BET_INTERVAL_MIN;
}

class VirtualUser {
    constructor(userId) {
        this.userId = userId;
        this.balance = 0;
        this.socket = null;
        this.active = false;
        this.betCount = 0;
    }

    async initialize() {
        try {
            // Check initial balance
            const response = await axios.get(`${GATEWAY_URL}/api/balance/${this.userId}`);
            this.balance = response.data.balance;
            console.log(chalk.green(`✓ User ${this.userId} initialized with balance: ${this.balance}`));
        } catch (err) {
            console.log(chalk.yellow(`⚠ User ${this.userId} not found, will be created on first bet`));
            this.balance = 1000; // Assume initial balance
        }
    }

    connectWebSocket() {
        this.socket = io(WS_URL, {
            transports: ['websocket'],
            reconnection: true
        });

        this.socket.on('connect', () => {
            this.socket.emit('subscribe', this.userId);
        });

        this.socket.on('balance_update', (data) => {
            this.balance = data.balance;
            stats.balanceUpdates++;
        });

        this.socket.on('error', (err) => {
            console.error(chalk.red(`WebSocket error for ${this.userId}:`), err.message);
        });
    }

    async placeBet() {
        const amount = randomBetAmount();

        try {
            const response = await axios.post(`${GATEWAY_URL}/api/bet`, {
                user_id: this.userId,
                amount,
                game_data: { game: 'aviator', multiplier: Math.random() * 10 }
            }, {
                timeout: 5000
            });

            stats.totalBets++;
            stats.successfulBets++;
            this.betCount++;

            this.balance = response.data.balance;

            if (this.betCount % 10 === 0) {
                console.log(chalk.blue(`User ${this.userId}: ${this.betCount} bets, balance: ${this.balance}`));
            }
        } catch (err) {
            stats.totalBets++;
            stats.failedBets++;

            if (err.response?.data?.error === 'Insufficient balance') {
                stats.insufficientBalance++;
            } else {
                const errorMsg = err.response?.data?.error || err.message;
                stats.errors[errorMsg] = (stats.errors[errorMsg] || 0) + 1;
            }
        }
    }

    async start() {
        this.active = true;
        this.connectWebSocket();

        while (this.active) {
            await this.placeBet();
            await new Promise(resolve => setTimeout(resolve, randomInterval()));
        }
    }

    stop() {
        this.active = false;
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

async function runLoadTest() {
    console.log(chalk.bold.cyan('\n🚀 Starting Load Test'));
    console.log(chalk.cyan(`Users: ${NUM_USERS}`));
    console.log(chalk.cyan(`Duration: ${DURATION_SECONDS}s`));
    console.log(chalk.cyan(`Bet Interval: ${BET_INTERVAL_MIN}-${BET_INTERVAL_MAX}ms`));
    console.log(chalk.cyan(`Gateway: ${GATEWAY_URL}\n`));

    stats.startTime = Date.now();

    // Create virtual users
    const users = [];
    for (let i = 0; i < NUM_USERS; i++) {
        const userId = generateUserId(i);
        const user = new VirtualUser(userId);
        await user.initialize();
        users.push(user);
    }

    console.log(chalk.green(`\n✓ ${NUM_USERS} users initialized\n`));

    // Start all users
    const userPromises = users.map(user => user.start());

    // Run for specified duration
    await new Promise(resolve => setTimeout(resolve, DURATION_SECONDS * 1000));

    // Stop all users
    console.log(chalk.yellow('\n⏸ Stopping test...\n'));
    users.forEach(user => user.stop());

    // Wait a bit for pending requests
    await new Promise(resolve => setTimeout(resolve, 2000));

    stats.endTime = Date.now();

    // Print results
    printResults();
}

function printResults() {
    const duration = (stats.endTime - stats.startTime) / 1000;
    const betsPerSecond = (stats.totalBets / duration).toFixed(2);
    const successRate = ((stats.successfulBets / stats.totalBets) * 100).toFixed(2);

    console.log(chalk.bold.cyan('\n📊 Load Test Results\n'));
    console.log(chalk.white('═'.repeat(50)));
    console.log(chalk.green(`Total Bets:           ${stats.totalBets}`));
    console.log(chalk.green(`Successful Bets:      ${stats.successfulBets}`));
    console.log(chalk.red(`Failed Bets:          ${stats.failedBets}`));
    console.log(chalk.yellow(`Insufficient Balance: ${stats.insufficientBalance}`));
    console.log(chalk.blue(`Balance Updates:      ${stats.balanceUpdates}`));
    console.log(chalk.white('─'.repeat(50)));
    console.log(chalk.cyan(`Duration:             ${duration.toFixed(2)}s`));
    console.log(chalk.cyan(`Throughput:           ${betsPerSecond} bets/sec`));
    console.log(chalk.cyan(`Success Rate:         ${successRate}%`));
    console.log(chalk.white('═'.repeat(50)));

    if (Object.keys(stats.errors).length > 0) {
        console.log(chalk.red('\n❌ Errors:'));
        Object.entries(stats.errors).forEach(([error, count]) => {
            console.log(chalk.red(`  ${error}: ${count}`));
        });
    }

    console.log('\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⚠ Interrupted by user'));
    process.exit(0);
});

// Run the test
runLoadTest().catch(err => {
    console.error(chalk.red('Load test failed:'), err);
    process.exit(1);
});
