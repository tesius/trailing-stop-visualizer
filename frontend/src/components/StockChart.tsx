import React, { useRef, useEffect } from 'react';
import {
    createChart,
    CandlestickSeries,
    LineSeries,
    createSeriesMarkers,
    ColorType,
    LineStyle,
    type IChartApi,
    type ISeriesApi,
    type SeriesMarker,
    type Time,
} from 'lightweight-charts';

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

interface ProfitTargetLevel {
    level: number;
    target_price: number;
    pct_from_entry: number;
    atr_multiple: number;
    sell_ratio: number;
}

interface PositionSell {
    date: string;
    price: number;
    ratio: number;
    remaining: number;
    level: number;
    label: string;
}

interface ExitStrategyData {
    trade_type: string;
    entry_price: number;
    stop_loss_price: number;
    first_tp_ratio: number;
    profit_targets: ProfitTargetLevel[];
    sells: PositionSell[];
    weighted_avg_sell_price: number | null;
    total_return_pct: number | null;
}

interface StockChartProps {
    data: ChartDataPoint[];
    ticker: string;
    currency: string;
    showStop: boolean;
    showBuy: boolean;
    onToggleStop: () => void;
    onToggleBuy: () => void;
    exitStrategy?: ExitStrategyData | null;
}

const StockChart: React.FC<StockChartProps> = ({ data, ticker, currency, showStop, showBuy, onToggleStop, onToggleBuy, exitStrategy }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const stopSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const buySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const entrySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sellMarkersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
    const buyMarkersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
    const exitMarkersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);

    const formatCurrency = (value: number) => {
        const symbol = currency === 'KRW' ? '₩' : '$';
        return `${symbol}${Math.floor(value).toLocaleString()}`;
    };

    // Create chart once
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#6b7280',
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            crosshair: {
                vertLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#374151' },
                horzLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#374151' },
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.06)',
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.06)',
                timeVisible: false,
            },
            localization: {
                priceFormatter: formatCurrency,
            },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        const stopSeries = chart.addSeries(LineSeries, {
            color: '#10b981',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        const buySeries = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // Entry price line (for exit strategy)
        const entrySeries = chart.addSeries(LineSeries, {
            color: '#eab308',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            crosshairMarkerVisible: false,
            lastValueVisible: true,
            priceLineVisible: false,
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        stopSeriesRef.current = stopSeries;
        buySeriesRef.current = buySeries;
        entrySeriesRef.current = entrySeries;

        sellMarkersRef.current = createSeriesMarkers(candleSeries, []);
        buyMarkersRef.current = createSeriesMarkers(candleSeries, []);
        exitMarkersRef.current = createSeriesMarkers(candleSeries, []);

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                chart.resize(width, height);
            }
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            stopSeriesRef.current = null;
            buySeriesRef.current = null;
            entrySeriesRef.current = null;
            sellMarkersRef.current = null;
            buyMarkersRef.current = null;
            exitMarkersRef.current = null;
        };
    }, []);

    // Update data
    useEffect(() => {
        if (!candleSeriesRef.current || !stopSeriesRef.current || !buySeriesRef.current || !entrySeriesRef.current) return;

        // Candlestick data
        const candleData = data.map(d => ({
            time: d.date as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));
        candleSeriesRef.current.setData(candleData);

        // Stop line
        if (showStop) {
            const stopData = data
                .filter(d => d.stop_price !== null)
                .map(d => ({ time: d.date as Time, value: d.stop_price! }));
            stopSeriesRef.current.setData(stopData);
        } else {
            stopSeriesRef.current.setData([]);
        }

        // Buy line
        if (showBuy) {
            const buyData = data
                .filter(d => d.buy_price !== null)
                .map(d => ({ time: d.date as Time, value: d.buy_price! }));
            buySeriesRef.current.setData(buyData);
        } else {
            buySeriesRef.current.setData([]);
        }

        // Entry price horizontal line (for exit strategy)
        if (exitStrategy?.entry_price && data.length > 0) {
            const entryData = data.map(d => ({
                time: d.date as Time,
                value: exitStrategy.entry_price,
            }));
            entrySeriesRef.current.setData(entryData);
        } else {
            entrySeriesRef.current.setData([]);
        }

        // Sell signal markers (crossover: prev above stop → current below stop)
        if (showStop && sellMarkersRef.current) {
            const sellMarkers: SeriesMarker<Time>[] = data
                .filter((d, i) => {
                    if (i === 0) return false;
                    const prev = data[i - 1];
                    return (
                        d.stop_price !== null &&
                        prev.stop_price !== null &&
                        prev.close > prev.stop_price &&
                        d.close <= d.stop_price
                    );
                })
                .map(d => ({
                    time: d.date as Time,
                    position: 'belowBar' as const,
                    color: '#ef4444',
                    shape: 'circle' as const,
                    text: 'S',
                }));
            sellMarkersRef.current.setMarkers(sellMarkers);
        } else if (sellMarkersRef.current) {
            sellMarkersRef.current.setMarkers([]);
        }

        // Buy signal markers (crossover: prev below buy → current above buy)
        if (showBuy && buyMarkersRef.current) {
            const buyMarkers: SeriesMarker<Time>[] = data
                .filter((d, i) => {
                    if (i === 0) return false;
                    const prev = data[i - 1];
                    return (
                        d.buy_price !== null &&
                        prev.buy_price !== null &&
                        prev.close < prev.buy_price &&
                        d.close >= d.buy_price
                    );
                })
                .map(d => ({
                    time: d.date as Time,
                    position: 'aboveBar' as const,
                    color: '#06b6d4',
                    shape: 'circle' as const,
                    text: 'B',
                }));
            buyMarkersRef.current.setMarkers(buyMarkers);
        } else if (buyMarkersRef.current) {
            buyMarkersRef.current.setMarkers([]);
        }

        // Exit strategy sell markers (TP hits and stop-loss hits)
        if (exitStrategy?.sells && exitMarkersRef.current) {
            const exitMarkers: SeriesMarker<Time>[] = exitStrategy.sells.map(s => ({
                time: s.date as Time,
                position: (s.level === 0 ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
                color: s.level === 0 ? '#f97316' : '#a855f7',
                shape: 'square' as const,
                text: s.level === 0 ? 'SL' : `TP${s.level}`,
            }));
            exitMarkersRef.current.setMarkers(exitMarkers);
        } else if (exitMarkersRef.current) {
            exitMarkersRef.current.setMarkers([]);
        }

        // Fit content
        chartRef.current?.timeScale().fitContent();
    }, [data, showStop, showBuy, exitStrategy]);

    return (
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6 animate-fade-in-up">
            {/* Header with ticker and toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h2 className="text-lg font-semibold text-white">{ticker.toUpperCase()} Analysis</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleStop}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            showStop
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/[0.04] text-gray-500 border border-white/[0.06]'
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${showStop ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                        Stop
                    </button>
                    <button
                        onClick={onToggleBuy}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            showBuy
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-white/[0.04] text-gray-500 border border-white/[0.06]'
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${showBuy ? 'bg-amber-400' : 'bg-gray-600'}`} />
                        Buy
                    </button>
                </div>
            </div>
            <div ref={chartContainerRef} className="h-[350px] md:h-[500px]" />
        </div>
    );
};

export default StockChart;
