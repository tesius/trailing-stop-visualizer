import React from 'react';
import type { Holding, QuoteData } from '../api/client';

interface WatchlistSidebarProps {
    holdings: Holding[];
    quotes: Map<string, QuoteData>;
    quotesLoading: boolean;
    activeId: string | null;
    onSelect: (id: string) => void;
    onEdit: (holding: Holding) => void;
    onAdd: () => void;
}

function formatPrice(price: number, currency: string): string {
    const symbol = currency === 'KRW' ? '₩' : '$';
    return `${symbol}${Math.round(price).toLocaleString()}`;
}

function rsiZoneClass(rsi: number | null | undefined): string {
    if (rsi == null) return 'text-gray-500 bg-white/[0.04]';
    if (rsi >= 70) return 'text-red-400 bg-red-500/10';
    if (rsi <= 30) return 'text-sky-400 bg-sky-500/10';
    return 'text-gray-400 bg-white/[0.04]';
}

const WatchlistSidebar: React.FC<WatchlistSidebarProps> = ({
    holdings, quotes, quotesLoading, activeId, onSelect, onEdit, onAdd,
}) => {
    return (
        <aside className="lg:w-72 lg:shrink-0">
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 no-scrollbar">
                {holdings.map((h) => {
                    const active = h.id === activeId;
                    const q = quotes.get(h.ticker.toUpperCase());
                    const name = h.alias?.trim() || h.ticker;
                    const change = q?.change_pct ?? null;
                    const changeUp = change != null && change >= 0;
                    const macdUp = q?.macd_hist != null && q.macd_hist >= 0;

                    return (
                        <div
                            key={h.id}
                            className={`group relative shrink-0 min-w-[180px] lg:min-w-0 rounded-xl border transition-all cursor-pointer ${
                                active
                                    ? 'bg-blue-600/15 border-blue-500/40'
                                    : 'bg-white/[0.03] border-white/[0.07] hover:border-white/20'
                            }`}
                            onClick={() => onSelect(h.id)}
                        >
                            <div className="px-3.5 py-3">
                                {/* 헤더: 이름 + 편집 */}
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                        <span className="font-semibold text-white text-sm truncate">{name}</span>
                                        {h.alias?.trim() && (
                                            <span className="text-[10px] font-mono text-gray-500 shrink-0">{h.ticker}</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onEdit(h); }}
                                        className={`text-gray-500 hover:text-white transition-all shrink-0 ${
                                            active ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
                                        }`}
                                        title="편집"
                                        aria-label="편집"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                </div>

                                {/* 가격 + 등락 */}
                                <div className="flex items-baseline gap-2 mb-2">
                                    {q?.price != null ? (
                                        <>
                                            <span className="text-white font-medium text-sm tabular-nums">
                                                {formatPrice(q.price, q.currency)}
                                            </span>
                                            {change != null && (
                                                <span className={`text-xs font-medium tabular-nums ${changeUp ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {changeUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-600">
                                            {q?.error ? '조회 실패' : quotesLoading ? '불러오는 중…' : '—'}
                                        </span>
                                    )}
                                </div>

                                {/* 지표 배지 */}
                                <div className="flex items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${rsiZoneClass(q?.rsi)}`}>
                                        RSI {q?.rsi != null ? q.rsi.toFixed(0) : '–'}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        q?.macd_hist == null ? 'text-gray-500 bg-white/[0.04]' : macdUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                                    }`}>
                                        MACD {q?.macd_hist == null ? '–' : macdUp ? '↑' : '↓'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={onAdd}
                    className="shrink-0 min-w-[120px] lg:min-w-0 flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-sm font-medium bg-white/[0.03] border border-dashed border-white/[0.15] text-gray-400 hover:text-white hover:border-white/30 transition-all"
                >
                    + 종목 추가
                </button>
            </div>
        </aside>
    );
};

export default WatchlistSidebar;
