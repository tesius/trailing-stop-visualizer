import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Header from './components/Header';
import Footer from './components/Footer';
import InputForm from './components/InputForm';
import type { ExitStrategyInputs } from './components/InputForm';
import StockChart from './components/StockChart';
import StatsPanel from './components/StatsPanel';
import ATRInfo from './components/ATRInfo';
import ExitStrategyInfo from './components/ExitStrategyInfo';
import BacktestPanel from './components/BacktestPanel';
import ErrorBanner from './components/ErrorBanner';
import LoadingSkeleton from './components/LoadingSkeleton';
import { analyzeStock } from './api/client';
import { runBacktest } from './utils/backtest';
import type { ExitStrategyParams } from './api/client';
import type { MAConfig, MAType } from './utils/movingAverage';
import { MA_COLORS } from './utils/movingAverage';

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

  const [showStop, setShowStop] = useState(true);
  const [showBuy, setShowBuy] = useState(true);
  const [showBacktest, setShowBacktest] = useState(false);
  const [maConfigs, setMAConfigs] = useState<MAConfig[]>([]);

  const handleAddMA = (type: MAType, period: number) => {
    if (maConfigs.length >= 3) return;
    const id = `${type.toLowerCase()}-${period}`;
    if (maConfigs.some(c => c.id === id)) return;
    const color = MA_COLORS[maConfigs.length];
    setMAConfigs(prev => [...prev, { id, type, period, color }]);
  };

  const handleRemoveMA = (id: string) => {
    setMAConfigs(prev => {
      const next = prev.filter(c => c.id !== id);
      // 색상 재할당
      return next.map((c, i) => ({ ...c, color: MA_COLORS[i] }));
    });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['analyze', params.ticker, params.period, params.multiplier, params.days, params.interval,
      params.exitStrategy?.trade_type, params.exitStrategy?.entry_price, params.exitStrategy?.entry_date, params.exitStrategy?.first_tp_ratio],
    queryFn: () => analyzeStock(params.ticker, params.period, params.multiplier, params.days, params.interval, params.exitStrategy),
    enabled: params.shouldFetch && !!params.ticker,
    retry: false
  });

  const backtestResult = useMemo(() => {
    if (!data?.data || !showBacktest) return null;
    return runBacktest(data.data);
  }, [data?.data, showBacktest]);

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
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <Header />

      <main className="flex-1 px-4 pb-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="animate-fade-in-up">
            <InputForm onAnalyze={handleAnalyze} isLoading={isLoading} />
          </div>

          {error && <ErrorBanner error={error as any} />}

          {isLoading && <LoadingSkeleton />}

          {data && !isLoading && (
            <>
              <StatsPanel
                data={data.data}
                ticker={data.ticker}
                currency={data.currency}
                showStop={showStop}
                showBuy={showBuy}
              />
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
                showStop={showStop}
                showBuy={showBuy}
                onToggleStop={() => setShowStop(s => !s)}
                onToggleBuy={() => setShowBuy(b => !b)}
                exitStrategy={data.exit_strategy}
                maConfigs={maConfigs}
                onAddMA={handleAddMA}
                onRemoveMA={handleRemoveMA}
                showBacktest={showBacktest}
                onToggleBacktest={() => setShowBacktest(b => !b)}
              />
              {showBacktest && backtestResult && (
                <BacktestPanel result={backtestResult} />
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
