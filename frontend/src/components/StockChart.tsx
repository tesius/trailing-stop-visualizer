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

interface StockChartProps {
    data: ChartDataPoint[];
    ticker: string;
    currency: string;
}

const StockChart: React.FC<StockChartProps> = ({ data, ticker, currency }) => {
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

    const series = [
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

    const formatCurrency = (value: number) => {
        const symbol = currency === 'KRW' ? '₩' : '$';
        return `${symbol}${Math.floor(value).toLocaleString()}`;
    };

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
            width: [1, 2, 0], // 0 width for scatter
            curve: 'smooth' // Smoother line for Trailing Stop
        },
        colors: ['#3b82f6', '#10b981', '#ef4444'], // Blue, Emerald, Red (Sell)
        markers: {
            size: [0, 0, 6], // Only show markers for the 3rd series (Scatter)
            colors: ['#ef4444'],
            strokeColors: '#fff',
            strokeWidth: 2,
            hover: {
                size: 8
            }
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
