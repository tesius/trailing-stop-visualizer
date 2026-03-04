import type { BacktestResult } from '../utils/backtest';

interface BacktestPanelProps {
  result: BacktestResult;
}

export default function BacktestPanel({ result }: BacktestPanelProps) {
  const { trades, totalTrades, winRate, avgReturnPct, totalReturnPct, maxDrawdownPct, profitFactor, avgHoldingDays } = result;

  if (totalTrades === 0) {
    return (
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 animate-fade-in-up">
        <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-3">백테스트 결과</h3>
        <p className="text-gray-400 text-sm">해당 기간에 완결된 트레이드가 없습니다</p>
      </div>
    );
  }

  const fmtPct = (v: number, sign = true) => {
    const s = sign && v > 0 ? '+' : '';
    return `${s}${v.toFixed(1)}%`;
  };

  const fmtPF = (v: number) => (v === Infinity ? '∞' : v.toFixed(1));

  const colorPct = (v: number) => (v >= 0 ? 'text-emerald-400' : 'text-red-400');

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 animate-fade-in-up">
      <h3 className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-4">백테스트 결과</h3>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Stat label="트레이드" value={`${totalTrades}건`} />
        <Stat label="승률" value={fmtPct(winRate, false)} className={winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
        <Stat label="평균 수익률" value={fmtPct(avgReturnPct)} className={colorPct(avgReturnPct)} />
        <Stat label="누적 수익률" value={fmtPct(totalReturnPct)} className={colorPct(totalReturnPct)} />
        <Stat label="최대 낙폭" value={`-${maxDrawdownPct.toFixed(1)}%`} className="text-red-400" />
        <Stat label="손익비" value={fmtPF(profitFactor)} className={profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400'} />
        <Stat label="평균 보유" value={`${Math.round(avgHoldingDays)}일`} />
      </div>

      {/* Trade history table */}
      <div>
        <h4 className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-2">트레이드 내역</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-white/10">
                <th className="text-left py-1 px-2">#</th>
                <th className="text-left py-1 px-2">진입일</th>
                <th className="text-right py-1 px-2">진입가</th>
                <th className="text-left py-1 px-2">청산일</th>
                <th className="text-right py-1 px-2">청산가</th>
                <th className="text-right py-1 px-2">수익률</th>
                <th className="text-right py-1 px-2">보유</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i} className="border-b border-white/5 text-white/80">
                  <td className="py-1 px-2 font-mono text-gray-400">{i + 1}</td>
                  <td className="py-1 px-2 font-mono text-xs">{t.entryDate}</td>
                  <td className="text-right py-1 px-2 font-mono text-xs">{t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="py-1 px-2 font-mono text-xs">{t.exitDate}</td>
                  <td className="text-right py-1 px-2 font-mono text-xs">{t.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className={`text-right py-1 px-2 font-mono font-semibold ${colorPct(t.returnPct)}`}>
                    {fmtPct(t.returnPct)}
                  </td>
                  <td className="text-right py-1 px-2 font-mono text-gray-400">{t.holdingDays}일</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, className = 'text-white' }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 min-w-[90px]">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{label}</span>
      <span className={`text-lg font-semibold font-mono ${className}`}>{value}</span>
    </div>
  );
}
