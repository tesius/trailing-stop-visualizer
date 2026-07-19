import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { interpretIndicators, type InterpretResult } from '../api/client';

interface Point {
    date: string;
    close: number;
    rsi?: number | null;
    macd?: number | null;
    macd_signal?: number | null;
    macd_hist?: number | null;
    stop_price?: number | null;
    buy_price?: number | null;
}

interface AnalyzeLike {
    ticker: string;
    currency: string;
    data: Point[];
}

interface AiInterpretationProps {
    data: AnalyzeLike;
}

/** **bold** 와 줄바꿈/불릿만 처리하는 경량 마크다운 렌더러 (외부 의존성 회피). */
function renderInline(text: string): React.ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

function renderMarkdown(md: string): React.ReactNode {
    const lines = md.split('\n');
    const blocks: React.ReactNode[] = [];
    let list: string[] = [];

    const flushList = () => {
        if (list.length) {
            blocks.push(
                <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1 my-2">
                    {list.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
                </ul>
            );
            list = [];
        }
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        const bullet = line.match(/^\s*[-*]\s+(.*)/);
        const heading = line.match(/^\s*#{1,4}\s+(.*)/);
        if (bullet) {
            list.push(bullet[1]);
        } else if (heading) {
            flushList();
            blocks.push(<p key={`h-${blocks.length}`} className="font-semibold text-white mt-3 mb-1">{renderInline(heading[1])}</p>);
        } else if (line.trim() === '') {
            flushList();
        } else {
            flushList();
            blocks.push(<p key={`p-${blocks.length}`} className="my-1.5">{renderInline(line)}</p>);
        }
    }
    flushList();
    return blocks;
}

const AiInterpretation: React.FC<AiInterpretationProps> = ({ data }) => {
    const mutation = useMutation<InterpretResult, Error>({
        mutationFn: () => {
            const last = data.data[data.data.length - 1];
            return interpretIndicators({
                ticker: data.ticker,
                currency: data.currency,
                date: last.date,
                price: last.close,
                rsi: last.rsi,
                macd: last.macd,
                macd_signal: last.macd_signal,
                macd_hist: last.macd_hist,
                stop_price: last.stop_price,
                buy_price: last.buy_price,
            });
        },
    });

    const errorDetail = (mutation.error as (Error & { response?: { data?: { detail?: string } } }) | null)
        ?.response?.data?.detail;

    return (
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6 animate-fade-in-up">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-base">✨</span>
                    <h2 className="text-lg font-semibold text-white">AI 지표 해석</h2>
                    {mutation.data?.cached && (
                        <span className="text-[10px] text-gray-500 border border-white/10 rounded-full px-2 py-0.5">캐시</span>
                    )}
                </div>
                <button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all disabled:opacity-50"
                >
                    {mutation.isPending ? (
                        <>
                            <span className="w-3 h-3 border-2 border-indigo-300/40 border-t-indigo-300 rounded-full animate-spin" />
                            해석 중…
                        </>
                    ) : mutation.data ? '다시 해석' : 'AI 해석'}
                </button>
            </div>

            {mutation.isError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {errorDetail || 'AI 해석에 실패했습니다. 잠시 후 다시 시도해 주세요.'}
                </div>
            )}

            {mutation.data && (
                <div className="text-sm text-gray-300 leading-relaxed">
                    {renderMarkdown(mutation.data.interpretation)}
                    <p className="text-[10px] text-gray-600 mt-3">모델: {mutation.data.model}</p>
                </div>
            )}

            {!mutation.data && !mutation.isError && !mutation.isPending && (
                <p className="text-sm text-gray-500">
                    RSI·MACD·트레일링 스톱 지표를 AI가 해석해 요약해 드립니다. 버튼을 눌러 시작하세요.
                </p>
            )}
        </div>
    );
};

export default AiInterpretation;
