import React from 'react';
import type { Holding } from '../api/client';

interface HoldingTabsProps {
    holdings: Holding[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onEdit: (holding: Holding) => void;
    onAdd: () => void;
}

const HoldingTabs: React.FC<HoldingTabsProps> = ({ holdings, activeId, onSelect, onEdit, onAdd }) => {
    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {holdings.map((h) => {
                const active = h.id === activeId;
                const label = h.alias?.trim() || h.ticker;
                return (
                    <div
                        key={h.id}
                        className={`group flex items-center rounded-full border transition-all whitespace-nowrap ${
                            active
                                ? 'bg-blue-600/20 border-blue-500/40 text-white'
                                : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:border-white/20'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => onSelect(h.id)}
                            className="pl-4 pr-2 py-2 text-sm font-medium flex items-center gap-2"
                            title={h.alias ? `${h.alias} (${h.ticker})` : h.ticker}
                        >
                            {label}
                            {h.alias?.trim() && (
                                <span className="text-[10px] font-mono opacity-60">{h.ticker}</span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => onEdit(h)}
                            className={`pr-3 pl-1 py-2 text-gray-500 hover:text-white transition-all ${
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
                );
            })}
            <button
                type="button"
                onClick={onAdd}
                className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium bg-white/[0.04] border border-dashed border-white/[0.15] text-gray-400 hover:text-white hover:border-white/30 transition-all whitespace-nowrap"
            >
                + 종목
            </button>
        </div>
    );
};

export default HoldingTabs;
