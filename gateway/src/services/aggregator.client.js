const axios = require('axios');

const aggregatorUrl = process.env.AGGREGATOR_URL || 'https://aggregator.example.com/api';

async function placeBet(betData) {
    try {
        const response = await axios.post(`${aggregatorUrl}/bet`, betData, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.AGGREGATOR_API_KEY || 'test-key'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Aggregator bet failed:', error.message);
        throw new Error('Failed to place bet with aggregator');
    }
}

module.exports = { placeBet };
