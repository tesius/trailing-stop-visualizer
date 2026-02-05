import axios from 'axios';

const client = axios.create({
    baseURL: 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface ExitStrategyParams {
    trade_type?: string;
    entry_price?: number;
    entry_date?: string;
    first_tp_ratio?: number;
}

export const analyzeStock = async (
    ticker: string,
    period: number,
    multiplier: number,
    days: number,
    interval: string = '1d',
    exitStrategy?: ExitStrategyParams,
) => {
    const params: Record<string, unknown> = { ticker, period, multiplier, days, interval };
    if (exitStrategy?.trade_type) {
        params.trade_type = exitStrategy.trade_type;
    }
    if (exitStrategy?.entry_price) {
        params.entry_price = exitStrategy.entry_price;
    }
    if (exitStrategy?.entry_date) {
        params.entry_date = exitStrategy.entry_date;
    }
    if (exitStrategy?.first_tp_ratio) {
        params.first_tp_ratio = exitStrategy.first_tp_ratio;
    }
    const response = await client.get('/analyze', { params });
    return response.data;
};
