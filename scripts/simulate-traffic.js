const axios = require('axios');
const io = require('socket.io-client');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const crypto = require('crypto');

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
    .option('callback', {
        alias: 'c',
        type: 'string',
        description: 'Callback URL',
        default: 'http://localhost:3001'
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
    .option('init-wait', {
        type: 'number',
        description: 'Wait time in ms after user initialization',
        default: 5000
    })
    .argv;

const GATEWAY_URL = argv.gateway;
const CALLBACK_URL = argv.callback;
const WS_URL = argv.gateway;
const NUM_USERS = argv.users;
const DURATION_SECONDS = argv.duration;
const BET_INTERVAL_MIN = argv['bet-interval'];
const BET_INTERVAL_MAX = argv['bet-interval-max'];
const INIT_WAIT_MS = argv['init-wait'];

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

// Generate test user IDs with true randomness for fresh users each run
function generateUserId(index) {
    return crypto.randomUUID();
}

// Random bet amount between 10 and 100
function randomBetAmount() {
    return Math.floor(Math.random() * 91) + 10;
}

// Generate random initial balance for realistic scenarios
function randomInitialBalance() {
    const scenarios = [
        0,      // 20% - No balance (edge case)
        100,    // 20% - Low balance
        500,    // 20% - Medium balance
        1000,   // 20% - High balance
        5000    // 20% - Very high balance (whale user)
    ];
    return scenarios[Math.floor(Math.random() * scenarios.length)];
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

            // If balance is 0, initialize with random balance for realistic scenarios
            if (this.balance === 0) {
                const initialBalance = randomInitialBalance();

                if (initialBalance > 0) {
                    // Create user by simulating initial deposit via callback
                    try {
                        await axios.post(`${CALLBACK_URL}/callback`, {
                            type: 'win',
                            external_tx_id: crypto.randomUUID(),
                            user_id: this.userId,
                            bet_round_id: crypto.randomUUID(),
                            amount: initialBalance
                        }, {
                            headers: { 'x-signature': 'dummy' },
                            timeout: 5000
                        });

                        // Wait for Kafka processing (configurable)
                        await new Promise(resolve => setTimeout(resolve, INIT_WAIT_MS));

                        // Verify balance
                        const balanceCheck = await axios.get(`${GATEWAY_URL}/api/balance/${this.userId}`);
                        this.balance = balanceCheck.data.balance;
                        console.log(chalk.green(`✓ User ${this.userId} initialized with balance: ${this.balance}`));
                    } catch (initErr) {
                        console.log(chalk.yellow(`⚠ User ${this.userId} initialization failed, starting with 0 balance`));
                        this.balance = 0;
                    }
                } else {
                    console.log(chalk.gray(`✓ User ${this.userId} initialized with 0 balance (edge case)`));
                    this.balance = 0;
                }
            } else {
                console.log(chalk.green(`✓ User ${this.userId} initialized with existing balance: ${this.balance}`));
            }
        } catch (err) {
            console.log(chalk.red(`✗ User ${this.userId} initialization error: ${err.message}`));
            this.balance = 0;
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

    async sendChat() {
        if (!this.socket) return;
        const messages = [
            "LFG!", "Big win!", "Rigged!", "To the moon 🚀", "Anyone winning?",
            "Scam site", "Nice UI", "Give me luck", "Multiplier went crazy", "Lost it all :(",
            "LETS GOOO!", "OMG!", "WTF", "Easy money", "Cashed out!", "YOLO",
            "All in!", "Betting big", "Come on!", "Lucky streak!", "RIP balance",
            "Insane!", "No way!", "Again!", "One more!", "Jackpot!", "GG",
            "Unbelievable", "This is it!", "Here we go", "Boom!", "Crash incoming",
            "Hold!", "Wait for it", "Now!", "Too early", "Too late", "Perfect timing"
        ];
        const text = messages[Math.floor(Math.random() * messages.length)];
        this.socket.emit('chat_message', { user: `User-${this.userId.slice(0, 4)}`, text });
    }

    async start() {
        this.active = true;
        this.connectWebSocket();

        // More aggressive chat - 50% chance every 2 seconds
        const chatInterval = setInterval(() => {
            if (this.active && Math.random() > 0.5) {
                this.sendChat();
            }
        }, 2000);

        while (this.active) {
            await this.placeBet();
            // Faster betting - 500ms to 2000ms
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
        }

        clearInterval(chatInterval);
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
