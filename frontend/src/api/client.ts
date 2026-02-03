import axios from 'axios';

const client = axios.create({
    baseURL: 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const analyzeStock = async (ticker: string, period: number, multiplier: number, days: number, interval: string = '1d') => {
    const response = await client.get('/analyze', {
        params: { ticker, period, multiplier, days, interval }
    });
    return response.data;
};
