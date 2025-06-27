/**
 * Admin Charts Module
 * Handles all chart visualization functionality for the admin panel
 * Completely separate from main admin.js to maintain clean separation of concerns
 */

class AdminCharts {
    constructor() {
        this.charts = {};
        this.apiKey = null;
        this.initialized = false;
    }

    /**
     * Initialize the charts module
     * @param {string} apiKey - Admin API key for authentication
     */
    async init(apiKey) {
        this.apiKey = apiKey;
        
        // Only initialize if Chart.js is available and we have chart containers
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded - charts disabled');
            return;
        }

        if (!this.hasChartContainers()) {
            console.log('No chart containers found - charts disabled');
            return;
        }

        this.initialized = true;
        await this.loadAllCharts('24h');
        console.log('📊 Admin Charts initialized');
    }

    /**
     * Check if chart containers exist in the DOM
     */
    hasChartContainers() {
        const containers = ['usageTrendsChart', 'endpointChart', 'costTokenChart', 'errorRateChart'];
        return containers.some(id => document.getElementById(id));
    }

    /**
     * Load all charts with specified timeframe
     */
    async loadAllCharts(timeframe = '24h') {
        if (!this.initialized) return;

        try {
            const chartData = await this.fetchChartData(timeframe);
            
            // Create charts in parallel
            await Promise.all([
                this.createUsageTrendsChart(chartData.dailyUsage),
                this.createEndpointChart(chartData.endpoints),
                this.createCostTokenChart(chartData.dailyUsage),
                this.createErrorRateChart(chartData.dailyUsage)
            ]);
        } catch (error) {
            console.error('Error loading charts:', error);
        }
    }

    /**
     * Fetch chart data from API
     */
    async fetchChartData(timeframe) {
        const response = await fetch(`/api/admin/chart-data?timeframe=${timeframe}`, {
            headers: { 'X-API-Key': this.apiKey }
        });

        if (!response.ok) {
            throw new Error(`Chart data fetch failed: ${response.status}`);
        }

        return await response.json();
    }

    /**
     * Create daily usage trends chart
     */
    async createUsageTrendsChart(dailyData) {
        const ctx = document.getElementById('usageTrendsChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.usageTrends) {
            this.charts.usageTrends.destroy();
        }

        this.charts.usageTrends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyData.map(d => d.date),
                datasets: [{
                    label: 'API Requests',
                    data: dailyData.map(d => d.requests),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    /**
     * Create endpoint popularity chart
     */
    async createEndpointChart(endpointData) {
        const ctx = document.getElementById('endpointChart');
        if (!ctx) return;

        if (this.charts.endpoints) {
            this.charts.endpoints.destroy();
        }

        this.charts.endpoints = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: endpointData.map(e => e.name),
                datasets: [{
                    data: endpointData.map(e => e.requests),
                    backgroundColor: [
                        '#6366f1', '#8b5cf6', '#06b6d4', 
                        '#10b981', '#f59e0b', '#ef4444'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    /**
     * Create cost and token usage chart
     */
    async createCostTokenChart(dailyData) {
        const ctx = document.getElementById('costTokenChart');
        if (!ctx) return;

        if (this.charts.costToken) {
            this.charts.costToken.destroy();
        }

        this.charts.costToken = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dailyData.map(d => d.date),
                datasets: [{
                    label: 'Daily Cost ($)',
                    data: dailyData.map(d => d.cost),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    yAxisID: 'y'
                }, {
                    label: 'Tokens (K)',
                    data: dailyData.map(d => d.tokens / 1000),
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Cost ($)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Tokens (K)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    /**
     * Create error rate chart
     */
    async createErrorRateChart(dailyData) {
        const ctx = document.getElementById('errorRateChart');
        if (!ctx) return;

        if (this.charts.errorRate) {
            this.charts.errorRate.destroy();
        }

        this.charts.errorRate = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyData.map(d => d.date),
                datasets: [{
                    label: 'Success Rate (%)',
                    data: dailyData.map(d => d.successRate),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Error Rate (%)',
                    data: dailyData.map(d => d.errorRate),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Update charts with new timeframe
     */
    async updateTimeframe(timeframe) {
        if (!this.initialized) return;
        await this.loadAllCharts(timeframe);
    }

    /**
     * Destroy all charts (cleanup)
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
        this.initialized = false;
    }
}

// Export for use in admin.js
window.AdminCharts = AdminCharts; 