import React from 'react';

interface ChartDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    stop_price: number | null;
    buy_price: number | null;
}

interface StatsPanelProps {
    data: ChartDataPoint[];
    ticker: string;
    currency: string;
    showStop: boolean;
    showBuy: boolean;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ data, ticker, currency, showStop, showBuy }) => {
    const latest = data[data.length - 1];
    if (!latest) return null;

    const formatPrice = (value: number) => {
        const symbol = currency === 'KRW' ? '₩' : '$';
        return `${symbol}${Math.floor(value).toLocaleString()}`;
    };

    const stopDistance = latest.stop_price
        ? ((latest.close - latest.stop_price) / latest.close * 100).toFixed(1)
        : null;

    const buyDistance = latest.buy_price
        ? ((latest.buy_price - latest.close) / latest.close * 100).toFixed(1)
        : null;

    const cards = [
        {
            label: 'Current Price',
            value: formatPrice(latest.close),
            color: 'text-white',
            show: true,
        },
        {
            label: 'Stop Distance',
            value: stopDistance ? `${stopDistance}%` : '—',
            sub: latest.stop_price ? formatPrice(latest.stop_price) : undefined,
            color: 'text-emerald-400',
            show: showStop,
        },
        {
            label: 'Buy Distance',
            value: buyDistance ? `${buyDistance}%` : '—',
            sub: latest.buy_price ? formatPrice(latest.buy_price) : undefined,
            color: 'text-amber-400',
            show: showBuy,
        },
        {
            label: 'Ticker',
            value: ticker.toUpperCase(),
            color: 'text-blue-400',
            show: true,
        },
    ];

    const visibleCards = cards.filter(c => c.show);

    return (
        <div className={`grid gap-4 animate-fade-in-up ${
            visibleCards.length <= 2 ? 'grid-cols-2' :
            visibleCards.length === 3 ? 'grid-cols-2 md:grid-cols-3' :
            'grid-cols-2 md:grid-cols-4'
        }`}>
            {visibleCards.map((card) => (
                <div
                    key={card.label}
                    className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-xl p-4"
                >
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                        {card.label}
                    </p>
                    <p className={`text-xl font-bold ${card.color} font-mono`}>
                        {card.value}
                    </p>
                    {card.sub && (
                        <p className="text-xs text-gray-500 mt-1 font-mono">{card.sub}</p>
                    )}
                </div>
            ))}
        </div>
    );
};

export default StatsPanel;
