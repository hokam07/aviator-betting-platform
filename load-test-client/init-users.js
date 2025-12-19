const axios = require('axios');
const chalk = require('chalk');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const NUM_USERS = parseInt(process.env.NUM_USERS || '50');
const INITIAL_BALANCE = parseFloat(process.env.INITIAL_BALANCE || '10000');

function generateUserId(index) {
    const base = '550e8400-e29b-41d4-a716-4466554400';
    return `${base}${String(index).padStart(2, '0')}`;
}

async function initializeUser(userId) {
    try {
        // Place a small bet to trigger user creation
        await axios.post(`${GATEWAY_URL}/api/bet`, {
            user_id: userId,
            amount: 1,
            game_data: { game: 'init' }
        });

        console.log(chalk.green(`✓ User ${userId} initialized`));
        return true;
    } catch (err) {
        if (err.response?.data?.error === 'Insufficient balance') {
            console.log(chalk.yellow(`⚠ User ${userId} already exists`));
            return true;
        }
        console.error(chalk.red(`✗ Failed to initialize ${userId}:`), err.message);
        return false;
    }
}

async function initializeAllUsers() {
    console.log(chalk.bold.cyan(`\n🔧 Initializing ${NUM_USERS} test users...\n`));

    let success = 0;
    let failed = 0;

    for (let i = 0; i < NUM_USERS; i++) {
        const userId = generateUserId(i);
        const result = await initializeUser(userId);

        if (result) {
            success++;
        } else {
            failed++;
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(chalk.bold.cyan('\n📊 Initialization Complete\n'));
    console.log(chalk.green(`✓ Success: ${success}`));
    console.log(chalk.red(`✗ Failed: ${failed}`));
    console.log('');
}

initializeAllUsers().catch(err => {
    console.error(chalk.red('Initialization failed:'), err);
    process.exit(1);
});
