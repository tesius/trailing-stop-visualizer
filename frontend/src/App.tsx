import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import InputForm from './components/InputForm';
import type { ExitStrategyInputs } from './components/InputForm';
import StockChart from './components/StockChart';
import ATRInfo from './components/ATRInfo';
import ExitStrategyInfo from './components/ExitStrategyInfo';
import { analyzeStock } from './api/client';
import type { ExitStrategyParams } from './api/client';

function App() {
  const [params, setParams] = useState({
    ticker: '',
    period: 14,
    multiplier: 2.5,
    days: 365,
    interval: '1d',
    exitStrategy: undefined as ExitStrategyParams | undefined,
    shouldFetch: false
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['analyze', params.ticker, params.period, params.multiplier, params.days, params.interval,
      params.exitStrategy?.trade_type, params.exitStrategy?.entry_price, params.exitStrategy?.entry_date, params.exitStrategy?.first_tp_ratio],
    queryFn: () => analyzeStock(params.ticker, params.period, params.multiplier, params.days, params.interval, params.exitStrategy),
    enabled: params.shouldFetch && !!params.ticker,
    retry: false
  });

  const handleAnalyze = (ticker: string, period: number, multiplier: number, days: number, interval: string, exitInputs: ExitStrategyInputs) => {
    let exitStrategy: ExitStrategyParams | undefined;
    if (exitInputs.tradeType && exitInputs.entryPrice && exitInputs.entryPrice > 0 && exitInputs.entryDate) {
      exitStrategy = {
        trade_type: exitInputs.tradeType,
        entry_price: exitInputs.entryPrice,
        entry_date: exitInputs.entryDate,
        first_tp_ratio: exitInputs.firstTpRatio,
      };
    }
    setParams({ ticker, period, multiplier, days, interval, exitStrategy, shouldFetch: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8 text-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-10 tracking-tight">ATR Trailing Stop Visualizer</h1>

        <InputForm onAnalyze={handleAnalyze} isLoading={isLoading} />

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{(error as any).response?.data?.detail || (error as Error).message}</span>
          </div>
        )}

        {data && (
          <>
            <ATRInfo
              currentAtr={data.current_atr}
              volatilityAmount={data.volatility_amount}
              multiplier={params.multiplier}
              currency={data.currency}
            />
            {data.exit_strategy && (
              <ExitStrategyInfo data={data.exit_strategy} currency={data.currency} />
            )}
            <StockChart
              data={data.data}
              ticker={data.ticker}
              currency={data.currency}
              exitStrategy={data.exit_strategy}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
