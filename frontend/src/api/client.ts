import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const client = axios.create({
    baseURL: API_URL,
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

// ---- 워치리스트 요약 (Quotes) ----

export interface QuoteData {
    ticker: string;
    price: number | null;
    change_pct: number | null;
    rsi: number | null;
    macd_hist: number | null;
    currency: string;
    error: string | null;
}

export const getQuotes = async (tickers: string[]): Promise<QuoteData[]> => {
    if (tickers.length === 0) return [];
    const response = await client.get('/quotes', { params: { tickers: tickers.join(',') } });
    return response.data;
};

// ---- AI 지표 해석 (Gemini) ----

export interface InterpretPayload {
    ticker: string;
    currency: string;
    date: string;
    price: number;
    rsi?: number | null;
    macd?: number | null;
    macd_signal?: number | null;
    macd_hist?: number | null;
    stop_price?: number | null;
    buy_price?: number | null;
}

export interface InterpretResult {
    ticker: string;
    interpretation: string;
    model: string;
    cached: boolean;
}

export const interpretIndicators = async (payload: InterpretPayload): Promise<InterpretResult> => {
    const response = await client.post('/interpret', payload);
    return response.data;
};

// ---- 보유 종목 (Portfolio Holdings) ----

export interface Holding {
    id: string;
    ticker: string;
    alias?: string | null;
    memo?: string | null;
    period: number;
    multiplier: number;
    interval: string;
    days: number;
    order: number;
}

export type HoldingInput = Omit<Holding, 'id' | 'order'>;

export const getHoldings = async (): Promise<Holding[]> => {
    const response = await client.get('/holdings');
    return response.data;
};

export const createHolding = async (payload: Partial<HoldingInput> & { ticker: string }): Promise<Holding> => {
    const response = await client.post('/holdings', payload);
    return response.data;
};

export const updateHolding = async (id: string, payload: Partial<HoldingInput>): Promise<Holding> => {
    const response = await client.put(`/holdings/${id}`, payload);
    return response.data;
};

export const deleteHolding = async (id: string): Promise<void> => {
    await client.delete(`/holdings/${id}`);
};

export const reorderHoldings = async (ids: string[]): Promise<Holding[]> => {
    const response = await client.put('/holdings/order', { ids });
    return response.data;
};

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
