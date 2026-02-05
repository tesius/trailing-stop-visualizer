import React from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';

interface ChartDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    stop_price: number | null;
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
    exitStrategy?: ExitStrategyData | null;
}

const StockChart: React.FC<StockChartProps> = ({ data, ticker, currency, exitStrategy }) => {
    const candlestickData = data.map(d => ({
        x: new Date(d.date).getTime(),
        y: [d.open, d.high, d.low, d.close]
    }));

    const lineData = data
        .filter(d => d.stop_price !== null)
        .map(d => ({
            x: new Date(d.date).getTime(),
            y: d.stop_price
        }));

    const sellSignalData = data
        .filter(d => d.stop_price !== null && d.close < d.stop_price)
        .map(d => ({
            x: new Date(d.date).getTime(),
            y: d.close
        }));

    const series: ApexAxisChartSeries = [
        {
            name: 'Price',
            type: 'candlestick',
            data: candlestickData
        },
        {
            name: 'Trailing Stop',
            type: 'line',
            data: lineData
        },
        {
            name: 'Sell Signal',
            type: 'scatter',
            data: sellSignalData
        }
    ];

    // Add exit strategy sell simulation markers
    const exitSellData = exitStrategy?.sells
        ?.filter(s => s.level > 0)
        .map(s => ({
            x: new Date(s.date).getTime(),
            y: s.price
        })) ?? [];

    if (exitSellData.length > 0) {
        series.push({
            name: 'Take Profit',
            type: 'scatter',
            data: exitSellData
        });
    }

    // Stop-loss sells
    const exitStopData = exitStrategy?.sells
        ?.filter(s => s.level === 0)
        .map(s => ({
            x: new Date(s.date).getTime(),
            y: s.price
        })) ?? [];

    if (exitStopData.length > 0) {
        series.push({
            name: 'Stop-Loss Hit',
            type: 'scatter',
            data: exitStopData
        });
    }

    const formatCurrency = (value: number) => {
        const symbol = currency === 'KRW' ? '\u20A9' : '$';
        return `${symbol}${Math.floor(value).toLocaleString()}`;
    };

    // Build annotations for entry line and profit targets
    const yAnnotations: YAxisAnnotations[] = [];
    if (exitStrategy) {
        // Entry line
        yAnnotations.push({
            y: exitStrategy.entry_price,
            borderColor: '#eab308', // yellow
            strokeDashArray: 6,
            label: {
                text: `Entry ${formatCurrency(exitStrategy.entry_price)}`,
                borderColor: '#eab308',
                style: { color: '#000', background: '#eab308', fontSize: '10px', padding: { left: 4, right: 4, top: 2, bottom: 2 } },
                position: 'left',
            }
        });

        // Profit target lines
        exitStrategy.profit_targets.forEach((t) => {
            yAnnotations.push({
                y: t.target_price,
                borderColor: '#a855f7', // purple
                strokeDashArray: 4,
                label: {
                    text: `TP${t.level} ${formatCurrency(t.target_price)}`,
                    borderColor: '#a855f7',
                    style: { color: '#fff', background: '#7e22ce', fontSize: '10px', padding: { left: 4, right: 4, top: 2, bottom: 2 } },
                    position: 'left',
                }
            });
        });
    }

    // Determine colors and marker sizes based on series count
    const baseColors = ['#3b82f6', '#10b981', '#ef4444']; // Blue, Emerald, Red
    const baseStrokeWidths = [1, 2, 0];
    const baseMarkerSizes = [0, 0, 6];

    if (exitSellData.length > 0) {
        baseColors.push('#a855f7'); // purple for TP sells
        baseStrokeWidths.push(0);
        baseMarkerSizes.push(8);
    }
    if (exitStopData.length > 0) {
        baseColors.push('#f97316'); // orange for stop-loss hit
        baseStrokeWidths.push(0);
        baseMarkerSizes.push(8);
    }

    const options: ApexOptions = {
        chart: {
            type: 'rangeBar', // Main type
            height: 500,
            background: 'transparent', // Transparent for glassmorphism
            fontFamily: 'Inter, system-ui, sans-serif',
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            },
            animations: {
                enabled: true,
                speed: 800,
                animateGradually: {
                    enabled: true,
                    delay: 150
                },
                dynamicAnimation: {
                    enabled: false
                }
            }
        },
        theme: {
            mode: 'dark', // Dark theme for labels/grid
            palette: 'palette1'
        },
        title: {
            text: `${ticker} Analysis`,
            align: 'left',
            style: {
                color: '#fff',
                fontSize: '20px',
                fontWeight: 600
            }
        },
        stroke: {
            width: baseStrokeWidths,
            curve: 'smooth' // Smoother line for Trailing Stop
        },
        colors: baseColors,
        markers: {
            size: baseMarkerSizes,
            colors: baseColors.slice(2), // marker fill colors for scatter series
            strokeColors: '#fff',
            strokeWidth: 2,
            hover: {
                size: 8
            }
        },
        annotations: {
            yaxis: yAnnotations as any,
        },
        xaxis: {
            type: 'datetime',
            labels: {
                style: {
                    colors: '#9ca3af' // Gray-400
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
            tooltip: {
                enabled: false // Disable X-axis tooltip to reduce clutter/lag
            }
        },
        yaxis: {
            tooltip: {
                enabled: true
            },
            labels: {
                style: {
                    colors: '#9ca3af'
                },
                formatter: formatCurrency
            }
        },
        grid: {
            borderColor: '#374151', // Gray-700
            strokeDashArray: 4,
            xaxis: {
                lines: { show: false }
            }
        },
        plotOptions: {
            candlestick: {
                colors: {
                    upward: '#22c55e',   // Green-500
                    downward: '#ef4444'  // Red-500
                },
                wick: {
                    useFillColor: true
                }
            }
        },
        tooltip: {
            theme: 'dark',
            shared: true,
            custom: undefined
        }
    };

    return (
        <div className="bg-gray-900/60 border border-white/10 p-6 rounded-2xl shadow-xl mt-8">
            <ReactApexChart options={options} series={series} type="rangeBar" height={500} width="100%" />
        </div>
    );
};

export default StockChart;
