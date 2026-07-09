import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Header from './components/Header';
import Footer from './components/Footer';
import HoldingTabs from './components/HoldingTabs';
import HoldingModal from './components/HoldingModal';
import StockChart from './components/StockChart';
import StatsPanel from './components/StatsPanel';
import ATRInfo from './components/ATRInfo';
import BacktestPanel from './components/BacktestPanel';
import ErrorBanner from './components/ErrorBanner';
import LoadingSkeleton from './components/LoadingSkeleton';
import { analyzeStock } from './api/client';
import type { Holding, HoldingInput } from './api/client';
import { useHoldings } from './hooks/useHoldings';
import { runBacktest } from './utils/backtest';
import type { MAConfig, MAType } from './utils/movingAverage';
import { MA_COLORS } from './utils/movingAverage';

function App() {
  const { holdings, isLoading: holdingsLoading, create, update, remove } = useHoldings();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ holding: Holding | null } | null>(null);

  const [showStop, setShowStop] = useState(true);
  const [showBuy, setShowBuy] = useState(true);
  const [showBacktest, setShowBacktest] = useState(false);
  const [maConfigs, setMAConfigs] = useState<MAConfig[]>([]);

  const activeHolding = holdings.find(h => h.id === activeId) ?? null;

  // 활성 종목이 목록에서 사라지거나 아직 없을 때 첫 종목으로 폴백
  useEffect(() => {
    if (holdings.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !holdings.some(h => h.id === activeId)) {
      setActiveId(holdings[0].id);
    }
  }, [holdings, activeId]);

  // localStorage 최근 검색 이력 → 포트폴리오 1회 마이그레이션
  const seededRef = useRef(false);
  useEffect(() => {
    if (holdingsLoading || seededRef.current) return;
    seededRef.current = true;
    if (holdings.length > 0 || localStorage.getItem('portfolioMigrated')) return;
    const saved = localStorage.getItem('recentTickerSettings');
    if (!saved) return;
    (async () => {
      try {
        const items = JSON.parse(saved) as { ticker: string; period: number; multiplier: number }[];
        for (const it of items.slice(0, 10)) {
          await create.mutateAsync({ ticker: it.ticker, period: it.period, multiplier: it.multiplier });
        }
      } catch {
        // 무시 — 마이그레이션 실패해도 앱은 정상 동작
      } finally {
        localStorage.setItem('portfolioMigrated', '1');
      }
    })();
  }, [holdingsLoading, holdings, create]);

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
      return next.map((c, i) => ({ ...c, color: MA_COLORS[i] }));
    });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['analyze', activeHolding?.ticker, activeHolding?.period, activeHolding?.multiplier, activeHolding?.days, activeHolding?.interval],
    queryFn: () => analyzeStock(activeHolding!.ticker, activeHolding!.period, activeHolding!.multiplier, activeHolding!.days, activeHolding!.interval),
    enabled: !!activeHolding,
    retry: false,
  });

  const backtestResult = useMemo(() => {
    if (!data?.data || !showBacktest) return null;
    return runBacktest(data.data);
  }, [data?.data, showBacktest]);

  const handleModalSubmit = (payload: Partial<HoldingInput> & { ticker: string }) => {
    if (modal?.holding) {
      update.mutate({ id: modal.holding.id, payload }, { onSuccess: () => setModal(null) });
    } else {
      create.mutate(payload, {
        onSuccess: (created) => {
          setActiveId(created.id);
          setModal(null);
        },
      });
    }
  };

  const handleModalDelete = (id: string) => {
    remove.mutate(id, { onSuccess: () => setModal(null) });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      <Header />

      <main className="flex-1 px-4 pb-8">
        {/* Holding tabs */}
        <div className="max-w-[1600px] mx-auto mb-6">
          <HoldingTabs
            holdings={holdings}
            activeId={activeId}
            onSelect={setActiveId}
            onEdit={(h) => setModal({ holding: h })}
            onAdd={() => setModal({ holding: null })}
          />
        </div>

        {/* Results */}
        <div className="max-w-[1600px] mx-auto space-y-6">
          {/* 종목이 하나도 없을 때 */}
          {!holdingsLoading && holdings.length === 0 && (
            <div className="text-center py-24 animate-fade-in-up">
              <p className="text-gray-400 mb-4">등록된 보유 종목이 없습니다.</p>
              <button
                onClick={() => setModal({ holding: null })}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all text-sm"
              >
                + 첫 종목 추가하기
              </button>
            </div>
          )}

          {error && <ErrorBanner error={error as Error & { response?: { data?: { detail?: string } } }} />}

          {activeHolding && isLoading && <LoadingSkeleton />}

          {activeHolding && data && !isLoading && (
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
                multiplier={activeHolding.multiplier}
                currency={data.currency}
              />
              {activeHolding.memo && (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-5 py-3 text-sm text-gray-300">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mr-2">Memo</span>
                  {activeHolding.memo}
                </div>
              )}
              <StockChart
                data={data.data}
                ticker={data.ticker}
                currency={data.currency}
                showStop={showStop}
                showBuy={showBuy}
                onToggleStop={() => setShowStop(s => !s)}
                onToggleBuy={() => setShowBuy(b => !b)}
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

      {modal && (
        <HoldingModal
          holding={modal.holding}
          onSubmit={handleModalSubmit}
          onDelete={handleModalDelete}
          onClose={() => setModal(null)}
          isSaving={create.isPending || update.isPending}
        />
      )}

      <Footer />
    </div>
  );
}

export default App;
