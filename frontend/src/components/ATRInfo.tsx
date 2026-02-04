interface ATRInfoProps {
    currentAtr: number;
    volatilityAmount: number;
    multiplier: number;
    currency: string;
}

export default function ATRInfo({ currentAtr, volatilityAmount, multiplier, currency }: ATRInfoProps) {
    const symbol = currency === 'KRW' ? '₩' : '$';
    const format = (value: number) =>
        currency === 'KRW' ? `${symbol}${Math.round(value).toLocaleString()}` : `${symbol}${value.toFixed(2)}`;

    return (
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-xl mt-6 flex flex-wrap gap-6 items-center w-full max-w-6xl mx-auto">
            <div>
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">ATR</span>
                <p className="text-white text-lg font-semibold font-mono">{format(currentAtr)}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Multiplier</span>
                <p className="text-white text-lg font-semibold font-mono">×{multiplier}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Volatility Amount</span>
                <p className="text-emerald-400 text-lg font-semibold font-mono">{format(volatilityAmount)}</p>
            </div>
        </div>
    );
}
