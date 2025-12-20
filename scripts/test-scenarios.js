const crypto = require('crypto');

const CALLBACK_URL = 'http://127.0.0.1:3001/callback';
const API_URL = 'http://127.0.0.1:3000/api';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getBalance(userId) {
    try {
        const res = await fetch(`${API_URL}/balance/${userId}`);
        if (!res.ok) throw new Error(`Failed to fetch balance: ${res.statusText}`);
        const data = await res.json();
        return parseFloat(data.balance);
    } catch (err) {
        // If 404/500, assume 0 or error
        console.error(`Fetch error for ${userId}:`, err.message);
        return 0;
    }
}

async function sendEvent(event) {
    try {
        const res = await fetch(CALLBACK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-signature': 'test-sig'
            },
            body: JSON.stringify(event)
        });
        const txt = await res.text();
        return { status: res.status, body: txt };
    } catch (err) {
        console.error('Send event error:', err.message);
        return { status: 500 };
    }
}

function generateUuid() {
    return crypto.randomUUID();
}

async function runTest(name, fn) {
    console.log(`\n🔹 TEST: ${name}`);
    try {
        await fn();
        console.log(`✅ ${name} PASSED`);
    } catch (err) {
        console.error(`❌ ${name} FAILED: ${err.message}`);
        // process.exit(1); // Don't crash entire suite
    }
}

async function main() {
    console.log('🚀 Starting Comprehensive Scenario Tests...');

    // 1. New User Auto-Creation (Win Event)
    await runTest('New User Auto-Creation (Win)', async () => {
        const userId = generateUuid();
        const roundId = generateUuid();
        const txId = `tx-${Date.now()}`;

        // Initial balance should be 0 (implied)

        // Send Win
        await sendEvent({
            type: 'win',
            external_tx_id: txId,
            user_id: userId,
            bet_round_id: roundId,
            amount: 1000
        });

        await sleep(2000); // Wait for worker
        const balance = await getBalance(userId);
        if (balance !== 1000) throw new Error(`Expected balance 1000, got ${balance}`);
    });

    // 2. Betting Flow
    await runTest('Betting Flow (Win -> Bet)', async () => {
        const userId = generateUuid();

        // Seed with 1000
        await sendEvent({ type: 'win', external_tx_id: `seed-${Date.now()}`, user_id: userId, bet_round_id: generateUuid(), amount: 1000 });
        await sleep(2000);

        // Place Bet 200
        await sendEvent({
            type: 'bet',
            external_tx_id: `bet-${Date.now()}`,
            user_id: userId,
            bet_round_id: generateUuid(),
            amount: 200
        });
        await sleep(2000);

        const balance = await getBalance(userId);
        if (balance !== 800) throw new Error(`Expected balance 800, got ${balance}`);
    });

    // 3. Loss Flow
    await runTest('Loss Flow (No Balance Change)', async () => {
        const userId = generateUuid();

        // Seed 500
        await sendEvent({ type: 'win', external_tx_id: `seed-${Date.now()}`, user_id: userId, bet_round_id: generateUuid(), amount: 500 });
        await sleep(2000);

        // Loss event (usually follows a bet, but here we just check it doesn't add money)
        // Ideally we bet then loss.
        await sendEvent({
            type: 'bet',
            external_tx_id: `bet-${Date.now()}`,
            user_id: userId,
            bet_round_id: generateUuid(),
            amount: 100
        });
        await sleep(2000);
        // Balance should be 400

        await sendEvent({
            type: 'loss',
            external_tx_id: `loss-${Date.now()}`,
            user_id: userId,
            bet_round_id: generateUuid(),
            amount: 100 // Amount usually matches bet but logic ignores it for balance update
        });
        await sleep(2000);

        const balance = await getBalance(userId);
        if (balance !== 400) throw new Error(`Expected balance 400 (unchanged after loss), got ${balance}`);
    });

    // 4. Rollback Flows
    await runTest('Rollback Bet (Refund)', async () => {
        const userId = generateUuid();
        const roundId = generateUuid();

        // Seed 1000
        await sendEvent({ type: 'win', external_tx_id: `seed-${Date.now()}`, user_id: userId, bet_round_id: generateUuid(), amount: 1000 });
        await sleep(2000);

        // Bet 100
        const betTxId = `bet-${Date.now()}`;
        await sendEvent({ type: 'bet', external_tx_id: betTxId, user_id: userId, bet_round_id: roundId, amount: 100 });
        await sleep(2000);
        // Balance 900

        // Rollback Bet
        await sendEvent({
            type: 'rollback-bet',
            external_tx_id: `rb-bet-${Date.now()}`, // different tx id for the rollback event itself
            user_id: userId,
            bet_round_id: roundId,
            amount: 100
        });
        await sleep(2000);

        const balance = await getBalance(userId);
        if (balance !== 1000) throw new Error(`Expected balance 1000 (refunded), got ${balance}`);
    });

    await runTest('Rollback Win (Deduct)', async () => {
        const userId = generateUuid();
        const roundId = generateUuid();

        // Seed 0
        // Win 500
        await sendEvent({ type: 'win', external_tx_id: `win-${Date.now()}`, user_id: userId, bet_round_id: roundId, amount: 500 });
        await sleep(2000);
        // Balance 500

        // Rollback Win
        await sendEvent({
            type: 'rollback-win',
            external_tx_id: `rb-win-${Date.now()}`,
            user_id: userId,
            bet_round_id: roundId,
            amount: 500
        });
        await sleep(2000);

        const balance = await getBalance(userId);
        if (balance !== 0) throw new Error(`Expected balance 0 (deducted), got ${balance}`);
    });

    // 5. Insufficient Balance
    await runTest('Insufficient Balance', async () => {
        const userId = generateUuid();

        // Seed 100
        await sendEvent({ type: 'win', external_tx_id: `seed-${Date.now()}`, user_id: userId, bet_round_id: generateUuid(), amount: 100 });
        await sleep(2000);

        // Bet 200
        await sendEvent({
            type: 'bet',
            external_tx_id: `bet-${Date.now()}`,
            user_id: userId,
            bet_round_id: generateUuid(),
            amount: 200
        });
        await sleep(2000);

        const balance = await getBalance(userId);
        if (balance !== 100) throw new Error(`Expected balance 100 (txn rejected), got ${balance}`);
        // Note: Ledger worker logs should show "Insufficient balance"
    });

    // 6. Concurrency
    await runTest('Concurrency (Rapid Fire)', async () => {
        const userId = generateUuid();
        const roundId = generateUuid();

        // Seed 1000
        await sendEvent({ type: 'win', external_tx_id: `seed-${Date.now()}`, user_id: userId, bet_round_id: roundId, amount: 1000 });
        await sleep(2000);

        // Fire 5 bets of 100 concurrently
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(sendEvent({
                type: 'bet',
                external_tx_id: `concurrent-bet-${i}-${Date.now()}`,
                user_id: userId,
                bet_round_id: roundId,
                amount: 100
            }));
        }
        await Promise.all(promises);
        await sleep(4000); // Give enough time for sequential processing

        const balance = await getBalance(userId);
        // Expected: 1000 - 500 = 500
        if (balance !== 500) throw new Error(`Expected balance 500, got ${balance}`);
    });

    console.log('\n🏁 Tests Completed.');
}

main();
