export type MAType = 'SMA' | 'EMA';

export interface MAConfig {
  id: string;
  type: MAType;
  period: number;
  color: string;
}

export interface MADataPoint {
  time: string;
  value: number;
}

export const MA_COLORS = ['#818cf8', '#f472b6', '#38bdf8'];

export function calculateSMA(
  closes: { time: string; value: number }[],
  period: number,
): MADataPoint[] {
  const result: MADataPoint[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j].value;
    }
    result.push({ time: closes[i].time, value: sum / period });
  }
  return result;
}

export function calculateEMA(
  closes: { time: string; value: number }[],
  period: number,
): MADataPoint[] {
  if (closes.length < period) return [];

  const k = 2 / (period + 1);
  const result: MADataPoint[] = [];

  // First EMA value = SMA of first `period` closes
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i].value;
  }
  let ema = sum / period;
  result.push({ time: closes[period - 1].time, value: ema });

  for (let i = period; i < closes.length; i++) {
    ema = closes[i].value * k + ema * (1 - k);
    result.push({ time: closes[i].time, value: ema });
  }
  return result;
}

export function calculateMA(
  closes: { time: string; value: number }[],
  config: MAConfig,
): MADataPoint[] {
  return config.type === 'SMA'
    ? calculateSMA(closes, config.period)
    : calculateEMA(closes, config.period);
}
