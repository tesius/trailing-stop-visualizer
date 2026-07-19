import React, { useRef, useEffect, useState } from 'react';
import {
    createChart,
    CandlestickSeries,
    LineSeries,
    HistogramSeries,
    createSeriesMarkers,
    createTextWatermark,
    ColorType,
    LineStyle,
    type IChartApi,
    type ISeriesApi,
    type SeriesMarker,
    type Time,
} from 'lightweight-charts';
import type { MAConfig, MAType } from '../utils/movingAverage';
import { calculateMA } from '../utils/movingAverage';

const RANGE_PRESETS = [
    { key: '1M', label: '1M', days: 30 },
    { key: '3M', label: '3M', days: 90 },
    { key: '6M', label: '6M', days: 180 },
    { key: '1Y', label: '1Y', days: 365 },
    { key: 'All', label: 'All', days: 0 },
] as const;

type RangeKey = typeof RANGE_PRESETS[number]['key'];

// preset에 맞춰 차트 가시 범위를 설정한다. 전체 데이터는 로드된 상태로
// 최근 N일만 보이도록 하고, All이면 fitContent.
function applyVisibleRange(chart: IChartApi, data: { date: string }[], preset: RangeKey) {
    if (!data.length) return;
    const days = RANGE_PRESETS.find(p => p.key === preset)?.days ?? 0;
    if (days === 0) {
        chart.timeScale().fitContent();
        return;
    }
    const lastDate = new Date(data[data.length - 1].date);
    const fromDate = new Date(lastDate);
    fromDate.setDate(fromDate.getDate() - days);
    const fromTime = fromDate.getTime();
    const fromPoint = data.find(d => new Date(d.date).getTime() >= fromTime);
    if (!fromPoint) {
        chart.timeScale().fitContent();
        return;
    }
    chart.timeScale().setVisibleRange({
        from: fromPoint.date as Time,
        to: data[data.length - 1].date as Time,
    });
}

interface ChartDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    stop_price: number | null;
    buy_price: number | null;
    rsi?: number | null;
    macd?: number | null;
    macd_signal?: number | null;
    macd_hist?: number | null;
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
    maConfigs: MAConfig[];
    onAddMA: (type: MAType, period: number) => void;
    onRemoveMA: (id: string) => void;
    showBacktest: boolean;
    onToggleBacktest: () => void;
}

const StockChart: React.FC<StockChartProps> = ({ data, ticker, currency, showStop, showBuy, onToggleStop, onToggleBuy, exitStrategy, maConfigs, onAddMA, onRemoveMA, showBacktest, onToggleBacktest }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const stopSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const buySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const entrySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdHistSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const sellMarkersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
    const buyMarkersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
    const exitMarkersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
    const maSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

    const [rangePreset, setRangePreset] = useState<RangeKey>('3M');
    const [maDropdownOpen, setMaDropdownOpen] = useState(false);
    const [maType, setMaType] = useState<MAType>('SMA');
    const [maPeriod, setMaPeriod] = useState(20);
    const maDropdownRef = useRef<HTMLDivElement>(null);

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
                dateFormat: 'yyyy.MM.dd',
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

        // ---- RSI pane (index 1) ----
        const rsiSeries = chart.addSeries(LineSeries, {
            color: '#a78bfa',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
        }, 1);
        rsiSeries.createPriceLine({ price: 70, color: 'rgba(239,68,68,0.35)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
        rsiSeries.createPriceLine({ price: 30, color: 'rgba(56,189,248,0.35)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' });

        // ---- MACD pane (index 2) ----
        const macdHistSeries = chart.addSeries(HistogramSeries, {
            priceLineVisible: false,
            lastValueVisible: false,
        }, 2);
        const macdSeries = chart.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        }, 2);
        const macdSignalSeries = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        }, 2);

        // Pane 높이 비율 (메인:RSI:MACD = 3:1:1) 및 라벨
        const panes = chart.panes();
        panes[0]?.setStretchFactor(3);
        panes[1]?.setStretchFactor(1);
        panes[2]?.setStretchFactor(1);
        if (panes[1]) {
            createTextWatermark(panes[1], {
                horzAlign: 'left', vertAlign: 'top',
                lines: [{ text: 'RSI (14)', color: 'rgba(167,139,250,0.5)', fontSize: 11 }],
            });
        }
        if (panes[2]) {
            createTextWatermark(panes[2], {
                horzAlign: 'left', vertAlign: 'top',
                lines: [{ text: 'MACD (12, 26, 9)', color: 'rgba(59,130,246,0.5)', fontSize: 11 }],
            });
        }

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        stopSeriesRef.current = stopSeries;
        buySeriesRef.current = buySeries;
        entrySeriesRef.current = entrySeries;
        rsiSeriesRef.current = rsiSeries;
        macdSeriesRef.current = macdSeries;
        macdSignalSeriesRef.current = macdSignalSeries;
        macdHistSeriesRef.current = macdHistSeries;

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
            rsiSeriesRef.current = null;
            macdSeriesRef.current = null;
            macdSignalSeriesRef.current = null;
            macdHistSeriesRef.current = null;
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

        // RSI pane
        if (rsiSeriesRef.current) {
            const rsiData = data
                .filter(d => d.rsi != null)
                .map(d => ({ time: d.date as Time, value: d.rsi as number }));
            rsiSeriesRef.current.setData(rsiData);
        }

        // MACD pane (히스토그램 + MACD 라인 + 시그널 라인)
        if (macdHistSeriesRef.current) {
            const histData = data
                .filter(d => d.macd_hist != null)
                .map(d => ({
                    time: d.date as Time,
                    value: d.macd_hist as number,
                    color: (d.macd_hist as number) >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
                }));
            macdHistSeriesRef.current.setData(histData);
        }
        if (macdSeriesRef.current) {
            macdSeriesRef.current.setData(
                data.filter(d => d.macd != null).map(d => ({ time: d.date as Time, value: d.macd as number }))
            );
        }
        if (macdSignalSeriesRef.current) {
            macdSignalSeriesRef.current.setData(
                data.filter(d => d.macd_signal != null).map(d => ({ time: d.date as Time, value: d.macd_signal as number }))
            );
        }

        // 기본 가시 범위 적용 (최근 1개월 등)
        if (chartRef.current) {
            applyVisibleRange(chartRef.current, data, rangePreset);
        }
    }, [data, showStop, showBuy, exitStrategy, rangePreset]);

    // MA series management
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !data.length) return;

        const closes = data.map(d => ({ time: d.date, value: d.close }));
        const currentIds = new Set(maConfigs.map(c => c.id));
        const map = maSeriesMapRef.current;

        // Remove series no longer in config
        for (const [id, series] of map) {
            if (!currentIds.has(id)) {
                chart.removeSeries(series);
                map.delete(id);
            }
        }

        // Add or update series
        for (const config of maConfigs) {
            let series = map.get(config.id);
            if (!series) {
                series = chart.addSeries(LineSeries, {
                    color: config.color,
                    lineWidth: 1,
                    lineStyle: LineStyle.Solid,
                    crosshairMarkerVisible: false,
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                map.set(config.id, series);
            } else {
                series.applyOptions({ color: config.color });
            }
            const maData = calculateMA(closes, config).map(d => ({
                time: d.time as Time,
                value: d.value,
            }));
            series.setData(maData);
        }
    }, [data, maConfigs]);

    // Close MA dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (maDropdownRef.current && !maDropdownRef.current.contains(e.target as Node)) {
                setMaDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleAddMASubmit = () => {
        if (maPeriod > 0) {
            onAddMA(maType, maPeriod);
            setMaDropdownOpen(false);
        }
    };

    return (
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-6 animate-fade-in-up">
            {/* Header with ticker and toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h2 className="text-lg font-semibold text-white">{ticker.toUpperCase()} Analysis</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Range preset */}
                    <div className="flex bg-white/[0.04] rounded-full p-1 border border-white/[0.08]">
                        {RANGE_PRESETS.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setRangePreset(p.key)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                    rangePreset === p.key
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <span className="w-px h-5 bg-white/10" />
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

                    <span className="w-px h-5 bg-white/10" />
                    <button
                        onClick={onToggleBacktest}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            showBacktest
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-white/[0.04] text-gray-500 border border-white/[0.06]'
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${showBacktest ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                        Backtest
                    </button>

                    {maConfigs.length > 0 && (
                        <span className="w-px h-5 bg-white/10" />
                    )}

                    {maConfigs.map(c => (
                        <span
                            key={c.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 bg-white/[0.04] text-gray-300"
                        >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.type} {c.period}
                            <button
                                onClick={() => onRemoveMA(c.id)}
                                className="ml-0.5 text-gray-500 hover:text-white transition-colors"
                            >
                                &times;
                            </button>
                        </span>
                    ))}

                    <div className="relative" ref={maDropdownRef}>
                        <button
                            onClick={() => setMaDropdownOpen(o => !o)}
                            disabled={maConfigs.length >= 3}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                maConfigs.length >= 3
                                    ? 'bg-white/[0.02] text-gray-600 border-white/[0.04] cursor-not-allowed'
                                    : 'bg-white/[0.04] text-gray-400 border-white/[0.06] hover:text-white hover:border-white/20'
                            }`}
                        >
                            + MA
                        </button>
                        {maDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 z-50 bg-gray-900 border border-white/10 rounded-xl p-3 shadow-xl min-w-[180px]">
                                <div className="flex gap-2 mb-2">
                                    <button
                                        onClick={() => setMaType('SMA')}
                                        className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                                            maType === 'SMA' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        SMA
                                    </button>
                                    <button
                                        onClick={() => setMaType('EMA')}
                                        className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                                            maType === 'EMA' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        EMA
                                    </button>
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={maPeriod}
                                    onChange={e => setMaPeriod(Number(e.target.value))}
                                    onKeyDown={e => e.key === 'Enter' && handleAddMASubmit()}
                                    className="w-full px-2 py-1.5 mb-2 rounded bg-white/[0.06] border border-white/10 text-white text-xs focus:outline-none focus:border-white/30"
                                    placeholder="Period"
                                />
                                <button
                                    onClick={handleAddMASubmit}
                                    className="w-full px-2 py-1.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium hover:bg-indigo-500/30 transition-all"
                                >
                                    Add {maType} {maPeriod}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div ref={chartContainerRef} className="h-[520px] md:h-[720px]" />
        </div>
    );
};

export default StockChart;
