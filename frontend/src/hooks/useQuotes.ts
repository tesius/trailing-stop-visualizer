import { useQuery } from '@tanstack/react-query';
import { getQuotes, type QuoteData } from '../api/client';

/**
 * 워치리스트 요약(현재가/RSI/MACD)을 60초 주기로 폴링.
 * 반환: 티커(대문자) → QuoteData 맵.
 */
export function useQuotes(tickers: string[]) {
    // 정렬해 키를 안정화 (순서만 바뀌어도 재요청 방지)
    const sorted = [...tickers].map(t => t.toUpperCase()).sort();

    const query = useQuery({
        queryKey: ['quotes', sorted.join(',')],
        queryFn: () => getQuotes(sorted),
        enabled: sorted.length > 0,
        refetchInterval: 60_000,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
    });

    const map = new Map<string, QuoteData>();
    for (const q of query.data ?? []) {
        map.set(q.ticker.toUpperCase(), q);
    }

    return { quotes: map, isLoading: query.isLoading };
}
