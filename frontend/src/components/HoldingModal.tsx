import React, { useEffect, useState } from 'react';
import type { Holding, HoldingInput } from '../api/client';

interface HoldingModalProps {
    holding: Holding | null; // null = 추가 모드
    onSubmit: (payload: Partial<HoldingInput> & { ticker: string }) => void;
    onDelete?: (id: string) => void;
    onClose: () => void;
    isSaving?: boolean;
}

const DEFAULT_PERIOD = 14;
const DEFAULT_MULTIPLIER = 2.5;
const DEFAULT_DAYS = 365;

const HoldingModal: React.FC<HoldingModalProps> = ({ holding, onSubmit, onDelete, onClose, isSaving }) => {
    const isEdit = !!holding;
    const [ticker, setTicker] = useState(holding?.ticker ?? '');
    const [alias, setAlias] = useState(holding?.alias ?? '');
    const [memo, setMemo] = useState(holding?.memo ?? '');
    const [period, setPeriod] = useState(holding?.period ?? DEFAULT_PERIOD);
    const [multiplier, setMultiplier] = useState(holding?.multiplier ?? DEFAULT_MULTIPLIER);
    const [interval, setInterval] = useState(holding?.interval ?? '1d');
    const [days, setDays] = useState(holding?.days ?? DEFAULT_DAYS);

    // ESC로 닫기
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticker.trim()) return;
        onSubmit({
            ticker: ticker.trim().toUpperCase(),
            alias: alias.trim() || null,
            memo: memo.trim() || null,
            period,
            multiplier,
            interval,
            days,
        });
    };

    const inputClass =
        'bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm';
    const labelClass = 'text-[10px] font-bold text-gray-500 uppercase tracking-wider';

    return (
        <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
            onMouseDown={onClose}
        >
            <form
                onSubmit={handleSubmit}
                onMouseDown={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl my-8"
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{isEdit ? '종목 편집' : '종목 추가'}</h3>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">
                        &times;
                    </button>
                </div>

                {/* Ticker + Alias */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className={labelClass}>Ticker</label>
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            className={`${inputClass} font-mono`}
                            placeholder="AAPL / 005930"
                            autoFocus
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelClass}>별칭 (선택)</label>
                        <input
                            type="text"
                            value={alias ?? ''}
                            onChange={(e) => setAlias(e.target.value)}
                            className={inputClass}
                            placeholder="삼성전자"
                        />
                    </div>
                </div>

                {/* Interval */}
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Interval</label>
                    <div className="flex bg-white/[0.04] rounded-lg p-1 border border-white/[0.08]">
                        {['1d', '1wk', '1mo'].map((int) => (
                            <button
                                key={int}
                                type="button"
                                onClick={() => setInterval(int)}
                                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    interval === int ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                                }`}
                            >
                                {int === '1d' ? 'Daily' : int === '1wk' ? 'Weekly' : 'Monthly'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Period + Days */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className={labelClass}>ATR Period</label>
                        <input
                            type="number"
                            value={period}
                            onChange={(e) => setPeriod(parseInt(e.target.value) || DEFAULT_PERIOD)}
                            className={`${inputClass} text-center`}
                            min="1"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className={labelClass}>History Days</label>
                        <input
                            type="number"
                            value={days}
                            onChange={(e) => setDays(parseInt(e.target.value) || DEFAULT_DAYS)}
                            className={`${inputClass} text-center`}
                            min="30"
                        />
                    </div>
                </div>

                {/* Multiplier slider */}
                <div className="px-1">
                    <div className="flex justify-between items-center mb-2">
                        <label className={labelClass}>ATR Multiplier</label>
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

                {/* Memo */}
                <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>메모 (선택)</label>
                    <textarea
                        value={memo ?? ''}
                        onChange={(e) => setMemo(e.target.value)}
                        className={`${inputClass} resize-none`}
                        rows={2}
                        placeholder="진입 근거, 목표가 등"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                    {isEdit && onDelete && (
                        <button
                            type="button"
                            onClick={() => onDelete(holding.id)}
                            className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                        >
                            삭제
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-all"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all disabled:opacity-40 text-sm"
                    >
                        {isEdit ? '저장' : '추가'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default HoldingModal;
