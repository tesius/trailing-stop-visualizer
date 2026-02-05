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

    // Load recent tickers from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setRecentTickers(JSON.parse(saved));
        } else {
            // migrate old format (string[]) if present
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
            // Deselect
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
    }

    const handleRecentClick = (item: TickerSettings) => {
        setTicker(item.ticker);
        setPeriod(item.period);
        setMultiplier(item.multiplier);
        saveToRecent(item.ticker, item.period, item.multiplier);
        onAnalyze(item.ticker, item.period, item.multiplier, days, interval, getExitStrategyInputs());
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-xl flex flex-col gap-4 w-full max-w-6xl mx-auto">
            {/* Top Row: All Controls */}
            <div className="flex flex-wrap gap-4 items-end">

                {/* Ticker Input */}
                <div className="flex flex-col gap-1 min-w-[140px]">
                    <label className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Ticker</label>
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-base"
                        placeholder="AAPL"
                        required
                    />
                </div>

                {/* Interval Toggle */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Interval</label>
                    <div className="flex bg-black/20 rounded-lg p-1 border border-white/10 h-[42px]">
                        {['1d', '1wk', '1mo'].map((int) => (
                            <button
                                key={int}
                                type="button"
                                onClick={() => setInterval(int)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${interval === int
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {int === '1d' ? 'Daily' : int === '1wk' ? 'Weekly' : 'Monthly'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Period Input */}
                <div className="flex flex-col gap-1 w-20">
                    <label className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Period</label>
                    <input
                        type="number"
                        value={period}
                        onChange={(e) => setPeriod(parseInt(e.target.value))}
                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-base"
                        min="1"
                    />
                </div>

                {/* Days Input */}
                <div className="flex flex-col gap-1 w-24">
                    <label className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Days</label>
                    <input
                        type="number"
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-base"
                        min="30"
                    />
                </div>

                {/* Multiplier Slider (Inline) */}
                <div className="flex flex-col gap-1 flex-grow min-w-[200px] px-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Multiplier</label>
                        <span className="text-sm font-bold text-emerald-400 font-mono">{multiplier.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2 h-[42px]"> {/* Match height of inputs */}
                        <span className="text-[10px] text-gray-400">0.5</span>
                        <input
                            type="range"
                            min="0.5"
                            max="10"
                            step="0.1"
                            value={multiplier}
                            onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-[10px] text-gray-400">10</span>
                    </div>
                </div>

                {/* Analyze Button */}
                <div className="flex flex-col justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none h-[42px]"
                    >
                        {isLoading ? '...' : 'Analyze'}
                    </button>
                </div>
            </div>

            {/* Exit Strategy Row */}
            <div className="flex flex-wrap gap-4 items-end pt-2 border-t border-white/10">
                {/* Trade Type Toggle */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Trade Type</label>
                    <div className="flex bg-black/20 rounded-lg p-1 border border-white/10 h-[42px]">
                        {(['A', 'M', 'B'] as const).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleTradeTypeClick(type)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${tradeType === type
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                title={TRADE_TYPE_DEFAULTS[type].desc}
                            >
                                {TRADE_TYPE_DEFAULTS[type].label} <span className="text-[10px] opacity-70">{TRADE_TYPE_DEFAULTS[type].desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Entry Price */}
                {tradeType && (
                    <>
                        <div className="flex flex-col gap-1 w-32">
                            <label className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Entry Price</label>
                            <input
                                type="number"
                                value={entryPrice}
                                onChange={(e) => setEntryPrice(e.target.value)}
                                className="bg-black/20 border border-purple-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-center text-base font-mono"
                                placeholder="0.00"
                                step="0.01"
                                min="0.01"
                            />
                        </div>

                        <div className="flex flex-col gap-1 min-w-[180px]">
                            <label className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Entry Date</label>
                            <input
                                type="date"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                                className="bg-black/20 border border-purple-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-base font-mono [color-scheme:dark]"
                            />
                        </div>

                        {/* 1st TP Ratio Toggle */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">1st TP Sell</label>
                            <div className="flex bg-black/20 rounded-lg p-1 border border-white/10 h-[42px]">
                                {[0.5, 0.25].map((ratio) => (
                                    <button
                                        key={ratio}
                                        type="button"
                                        onClick={() => setFirstTpRatio(ratio)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${firstTpRatio === ratio
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
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

            {/* Bottom Row: Recent Tickers */}
            {recentTickers.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Recent:</span>
                    <div className="flex flex-wrap gap-2">
                        {recentTickers.map((item) => (
                            <button
                                key={item.ticker}
                                type="button"
                                onClick={() => handleRecentClick(item)}
                                className="text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-emerald-300 px-3 py-1 rounded-full transition-colors border border-white/5"
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
