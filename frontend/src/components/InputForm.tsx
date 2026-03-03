import React, { useState, useEffect } from 'react';

interface TickerSettings {
    ticker: string;
    period: number;
    multiplier: number;
}

export interface ExitStrategyInputs {
    tradeType: string | null;
    entryPrice: number | null;
    entryDate: string;
    firstTpRatio: number;
}

interface InputFormProps {
    onAnalyze: (ticker: string, period: number, multiplier: number, days: number, interval: string, exitStrategy: ExitStrategyInputs) => void;
    isLoading: boolean;
}

const STORAGE_KEY = 'recentTickerSettings';
const DEFAULT_PERIOD = 14;
const DEFAULT_MULTIPLIER = 2.5;

const TRADE_TYPE_DEFAULTS: Record<string, { period: number; multiplier: number; label: string; desc: string }> = {
    A: { period: 14, multiplier: 3.0, label: 'A', desc: 'Homerun' },
    M: { period: 20, multiplier: 2.5, label: 'M', desc: 'Mid-range' },
    B: { period: 22, multiplier: 2.0, label: 'B', desc: 'Single' },
};

const InputForm: React.FC<InputFormProps> = ({ onAnalyze, isLoading }) => {
    const [ticker, setTicker] = useState('AAPL');
    const [period, setPeriod] = useState(DEFAULT_PERIOD);
    const [multiplier, setMultiplier] = useState(DEFAULT_MULTIPLIER);
    const [days, setDays] = useState(365);
    const [interval, setInterval] = useState('1d');
    const [recentTickers, setRecentTickers] = useState<TickerSettings[]>([]);

    // Exit strategy state
    const [tradeType, setTradeType] = useState<string | null>(null);
    const [entryPrice, setEntryPrice] = useState<string>('');
    const [entryDate, setEntryDate] = useState<string>('');
    const [firstTpRatio, setFirstTpRatio] = useState<number>(0.5);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setRecentTickers(JSON.parse(saved));
        } else {
            const legacy = localStorage.getItem('recentTickers');
            if (legacy) {
                const old: string[] = JSON.parse(legacy);
                const migrated = old.map(t => ({ ticker: t, period: DEFAULT_PERIOD, multiplier: DEFAULT_MULTIPLIER }));
                setRecentTickers(migrated);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                localStorage.removeItem('recentTickers');
            }
        }
    }, []);

    const handleTradeTypeClick = (type: string) => {
        if (tradeType === type) {
            setTradeType(null);
            setPeriod(DEFAULT_PERIOD);
            setMultiplier(DEFAULT_MULTIPLIER);
        } else {
            setTradeType(type);
            const defaults = TRADE_TYPE_DEFAULTS[type];
            setPeriod(defaults.period);
            setMultiplier(defaults.multiplier);
        }
    };

    const getExitStrategyInputs = (): ExitStrategyInputs => ({
        tradeType,
        entryPrice: entryPrice ? parseFloat(entryPrice) : null,
        entryDate,
        firstTpRatio,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveToRecent(ticker, period, multiplier);
        onAnalyze(ticker, period, multiplier, days, interval, getExitStrategyInputs());
    };

    const saveToRecent = (newTicker: string, p: number, m: number) => {
        const uTicker = newTicker.toUpperCase();
        const entry: TickerSettings = { ticker: uTicker, period: p, multiplier: m };
        const updatedRecent = [entry, ...recentTickers.filter(t => t.ticker !== uTicker)].slice(0, 10);
        setRecentTickers(updatedRecent);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecent));
    };

    const handleRecentClick = (item: TickerSettings) => {
        setTicker(item.ticker);
        setPeriod(item.period);
        setMultiplier(item.multiplier);
        saveToRecent(item.ticker, item.period, item.multiplier);
        onAnalyze(item.ticker, item.period, item.multiplier, days, interval, getExitStrategyInputs());
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-5 rounded-2xl space-y-4">
            {/* Row 1: Inputs + Button */}
            <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_80px_90px_auto] gap-3 items-end">
                {/* Ticker */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ticker</label>
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono text-sm"
                        placeholder="AAPL"
                        required
                    />
                </div>

                {/* Interval Toggle */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Interval</label>
                    <div className="flex bg-white/[0.04] rounded-lg p-1 border border-white/[0.08] h-[42px]">
                        {['1d', '1wk', '1mo'].map((int) => (
                            <button
                                key={int}
                                type="button"
                                onClick={() => setInterval(int)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                    interval === int
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                                }`}
                            >
                                {int === '1d' ? 'Daily' : int === '1wk' ? 'Weekly' : 'Monthly'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Period */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Period</label>
                    <input
                        type="number"
                        value={period}
                        onChange={(e) => setPeriod(parseInt(e.target.value))}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-center text-sm"
                        min="1"
                    />
                </div>

                {/* Days */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Days</label>
                    <input
                        type="number"
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-center text-sm"
                        min="30"
                    />
                </div>

                {/* Analyze Button */}
                <div className="flex flex-col justify-end col-span-2 md:col-span-1">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed h-[42px] text-sm"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Analyzing
                            </span>
                        ) : 'Analyze'}
                    </button>
                </div>
            </div>

            {/* Row 2: Multiplier Slider */}
            <div className="px-1">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ATR Multiplier</label>
                    <span className="text-sm font-bold text-blue-400 font-mono">{multiplier.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-600 w-6">0.5</span>
                    <input
                        type="range"
                        min="0.5"
                        max="10"
                        step="0.1"
                        value={multiplier}
                        onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/[0.08] rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-[10px] text-gray-600 w-6 text-right">10</span>
                </div>
            </div>

            {/* Row 3: Exit Strategy */}
            <div className="flex flex-wrap gap-3 items-end pt-2 border-t border-white/[0.06]">
                {/* Trade Type Toggle */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Trade Type</label>
                    <div className="flex bg-white/[0.04] rounded-lg p-1 border border-white/[0.08] h-[42px]">
                        {(['A', 'M', 'B'] as const).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleTradeTypeClick(type)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${tradeType === type
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                                }`}
                                title={TRADE_TYPE_DEFAULTS[type].desc}
                            >
                                {TRADE_TYPE_DEFAULTS[type].label} <span className="text-[10px] opacity-70">{TRADE_TYPE_DEFAULTS[type].desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {tradeType && (
                    <>
                        <div className="flex flex-col gap-1.5 w-32">
                            <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Entry Price</label>
                            <input
                                type="number"
                                value={entryPrice}
                                onChange={(e) => setEntryPrice(e.target.value)}
                                className="bg-white/[0.04] border border-purple-500/30 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-center text-sm font-mono"
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Entry Date</label>
                            <input
                                type="date"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                                className="bg-white/[0.04] border border-purple-500/30 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm font-mono [color-scheme:dark]"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">1st TP Sell</label>
                            <div className="flex bg-white/[0.04] rounded-lg p-1 border border-white/[0.08] h-[42px]">
                                {[0.5, 0.25].map((ratio) => (
                                    <button
                                        key={ratio}
                                        type="button"
                                        onClick={() => setFirstTpRatio(ratio)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${firstTpRatio === ratio
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                                        }`}
                                    >
                                        {ratio * 100}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Row 4: Recent Tickers */}
            {recentTickers.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                    <span className="text-[10px] text-gray-600 uppercase font-bold">Recent:</span>
                    <div className="flex flex-wrap gap-1.5">
                        {recentTickers.map((item) => (
                            <button
                                key={item.ticker}
                                type="button"
                                onClick={() => handleRecentClick(item)}
                                className="text-xs bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white px-3 py-1 rounded-full transition-colors border border-white/[0.06] font-mono"
                                title={`Period: ${item.period}, Multiplier: ${item.multiplier}`}
                            >
                                {item.ticker}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </form>
    );
};

export default InputForm;
