interface ProfitTargetLevel {
    level: number;
    target_price: number;
    pct_from_entry: number;
    atr_multiple: number;
    sell_ratio: number;
}

interface PositionSell {
    date: string;
    price: number;
    ratio: number;
    remaining: number;
    level: number;
    label: string;
}

interface ExitStrategyData {
    trade_type: string;
    entry_price: number;
    stop_loss_price: number;
    first_tp_ratio: number;
    profit_targets: ProfitTargetLevel[];
    sells: PositionSell[];
    weighted_avg_sell_price: number | null;
    total_return_pct: number | null;
}

interface ExitStrategyInfoProps {
    data: ExitStrategyData;
    currency: string;
}

const TRADE_TYPE_LABELS: Record<string, string> = {
    A: 'Homerun',
    M: 'Mid-range',
    B: 'Single',
};

export default function ExitStrategyInfo({ data, currency }: ExitStrategyInfoProps) {
    const symbol = currency === 'KRW' ? '\u20A9' : '$';
    const fmt = (v: number) =>
        currency === 'KRW' ? `${symbol}${Math.round(v).toLocaleString()}` : `${symbol}${v.toFixed(2)}`;
    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

    return (
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl shadow-xl mt-6 w-full max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap gap-6 items-center mb-4">
                <div>
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Type</span>
                    <p className="text-white text-lg font-semibold">
                        {data.trade_type} <span className="text-purple-300 text-sm">({TRADE_TYPE_LABELS[data.trade_type] ?? data.trade_type})</span>
                    </p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div>
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Entry</span>
                    <p className="text-white text-lg font-semibold font-mono">{fmt(data.entry_price)}</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div>
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Stop Loss</span>
                    <p className="text-red-400 text-lg font-semibold font-mono">{fmt(data.stop_loss_price)}</p>
                </div>
                {data.weighted_avg_sell_price !== null && (
                    <>
                        <div className="w-px h-8 bg-white/20" />
                        <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Avg Sell</span>
                            <p className="text-emerald-400 text-lg font-semibold font-mono">{fmt(data.weighted_avg_sell_price)}</p>
                        </div>
                    </>
                )}
                {data.total_return_pct !== null && (
                    <>
                        <div className="w-px h-8 bg-white/20" />
                        <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Total Return</span>
                            <p className={`text-lg font-semibold font-mono ${data.total_return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {data.total_return_pct >= 0 ? '+' : ''}{data.total_return_pct.toFixed(1)}%
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Profit Targets Table */}
            <div className="mb-4">
                <h3 className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mb-2">Profit Targets</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 border-b border-white/10">
                                <th className="text-left py-1 px-2">Level</th>
                                <th className="text-right py-1 px-2">Target</th>
                                <th className="text-right py-1 px-2">From Entry</th>
                                <th className="text-right py-1 px-2">ATR x</th>
                                <th className="text-right py-1 px-2">Sell</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.profit_targets.map((t) => (
                                <tr key={t.level} className="border-b border-white/5 text-white/80">
                                    <td className="py-1 px-2 font-mono">TP{t.level}</td>
                                    <td className="text-right py-1 px-2 font-mono">{fmt(t.target_price)}</td>
                                    <td className="text-right py-1 px-2 font-mono text-purple-300">+{pct(t.pct_from_entry)}</td>
                                    <td className="text-right py-1 px-2 font-mono">{t.atr_multiple.toFixed(1)}</td>
                                    <td className="text-right py-1 px-2 font-mono">{pct(t.sell_ratio)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Simulation Timeline */}
            {data.sells.length > 0 && (
                <div>
                    <h3 className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mb-2">Simulation Timeline</h3>
                    <div className="space-y-1">
                        {data.sells.map((s, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-3 text-sm px-3 py-1.5 rounded-lg ${s.level === 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-purple-500/10 border border-purple-500/20'
                                    }`}
                            >
                                <span className="text-gray-400 font-mono text-xs w-24">{s.date}</span>
                                <span className={`font-semibold ${s.level === 0 ? 'text-red-400' : 'text-purple-300'}`}>
                                    {s.label}
                                </span>
                                <span className="text-white/60 font-mono text-xs ml-auto">
                                    {pct(s.ratio)} sold
                                </span>
                                <span className="text-gray-500 font-mono text-xs">
                                    {pct(s.remaining)} left
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
