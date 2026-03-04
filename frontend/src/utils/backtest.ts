export interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  stop_price: number | null;
  buy_price: number | null;
}

export interface BacktestTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  returnPct: number;
  holdingDays: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgReturnPct: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  avgHoldingDays: number;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export function runBacktest(data: ChartDataPoint[]): BacktestResult {
  const trades: BacktestTrade[] = [];
  let state: 'OUT' | 'IN' = 'OUT';
  let entryDate = '';
  let entryPrice = 0;

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    if (state === 'OUT') {
      // B signal: prev.close < prev.buy_price && curr.close >= curr.buy_price
      if (
        prev.buy_price !== null &&
        curr.buy_price !== null &&
        prev.close < prev.buy_price &&
        curr.close >= curr.buy_price
      ) {
        state = 'IN';
        entryDate = curr.date;
        entryPrice = curr.close;
      }
    } else {
      // S signal: prev.close > prev.stop_price && curr.close <= curr.stop_price
      if (
        prev.stop_price !== null &&
        curr.stop_price !== null &&
        prev.close > prev.stop_price &&
        curr.close <= curr.stop_price
      ) {
        const exitPrice = curr.close;
        const returnPct = (exitPrice - entryPrice) / entryPrice * 100;
        const holdingDays = daysBetween(entryDate, curr.date);
        trades.push({ entryDate, entryPrice, exitDate: curr.date, exitPrice, returnPct, holdingDays });
        state = 'OUT';
      }
    }
  }

  // Unclosed position is excluded

  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      trades,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgReturnPct: 0,
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      profitFactor: 0,
      avgHoldingDays: 0,
    };
  }

  const wins = trades.filter(t => t.returnPct > 0).length;
  const losses = totalTrades - wins;
  const winRate = (wins / totalTrades) * 100;
  const avgReturnPct = trades.reduce((s, t) => s + t.returnPct, 0) / totalTrades;
  const avgHoldingDays = trades.reduce((s, t) => s + t.holdingDays, 0) / totalTrades;

  // Compounded total return
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const t of trades) {
    equity *= 1 + t.returnPct / 100;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  const totalReturnPct = (equity - 1) * 100;
  const maxDrawdownPct = maxDrawdown * 100;

  // Profit factor
  const totalProfit = trades.filter(t => t.returnPct > 0).reduce((s, t) => s + t.returnPct, 0);
  const totalLoss = Math.abs(trades.filter(t => t.returnPct < 0).reduce((s, t) => s + t.returnPct, 0));
  const profitFactor = totalLoss === 0 ? Infinity : totalProfit / totalLoss;

  return {
    trades,
    totalTrades,
    wins,
    losses,
    winRate,
    avgReturnPct,
    totalReturnPct,
    maxDrawdownPct,
    profitFactor,
    avgHoldingDays,
  };
}
