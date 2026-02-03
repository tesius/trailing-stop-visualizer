import React, { useState, useEffect } from 'react';

interface InputFormProps {
    onAnalyze: (ticker: string, period: number, multiplier: number, days: number, interval: string) => void;
    isLoading: boolean;
    hasResult: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ onAnalyze, isLoading, hasResult }) => {
    const [ticker, setTicker] = useState('AAPL');
    const [period, setPeriod] = useState(14);
    const [multiplier, setMultiplier] = useState(2.5);
    const [days, setDays] = useState(365);
    const [interval, setInterval] = useState('1d');
    const [recentTickers, setRecentTickers] = useState<string[]>([]);

    // Load recent tickers from local storage on mount
    useEffect(() => {
        const savedTickers = localStorage.getItem('recentTickers');
        if (savedTickers) {
            setRecentTickers(JSON.parse(savedTickers));
        }
    }, []);

    // Debounce logic for real-time updates
    useEffect(() => {
        if (!hasResult) return;

        const timer = setTimeout(() => {
            onAnalyze(ticker, period, multiplier, days, interval);
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [multiplier, interval]); // Trigger on multiplier or interval change

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addToRecent(ticker);
        onAnalyze(ticker, period, multiplier, days, interval);
    };

    const addToRecent = (newTicker: string) => {
        const uTicker = newTicker.toUpperCase();
        const updatedRecent = [uTicker, ...recentTickers.filter(t => t !== uTicker)].slice(0, 5);
        setRecentTickers(updatedRecent);
        localStorage.setItem('recentTickers', JSON.stringify(updatedRecent));
    }

    const handleRecentClick = (clickedTicker: string) => {
        setTicker(clickedTicker);
        addToRecent(clickedTicker); // promote to first?
        onAnalyze(clickedTicker, period, multiplier, days, interval);
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

            {/* Bottom Row: Recent Tickers */}
            {recentTickers.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Recent:</span>
                    <div className="flex flex-wrap gap-2">
                        {recentTickers.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => handleRecentClick(t)}
                                className="text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-emerald-300 px-3 py-1 rounded-full transition-colors border border-white/5"
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </form>
    );
};

export default InputForm;
