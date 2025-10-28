// Reports Module
class Reports {
    constructor() {
        this.currentSprintData = [];
        this.previousSprintData = [];
        this.charts = {};
    }

    // Initialize reports
    async init() {
        try {
            // Wait for ADO service to be ready
            if (!window.adoService || !window.adoService.config) {
                await new Promise((resolve, reject) => {
                    let attempts = 0;
                    const checkConfig = setInterval(() => {
                        attempts++;
                        if (window.adoService && window.adoService.config) {
                            clearInterval(checkConfig);
                            resolve();
                        } else if (attempts > 50) { // 5 seconds timeout
                            clearInterval(checkConfig);
                            reject(new Error('ADO service not configured'));
                        }
                    }, 100);
                });
            }
            
            await this.loadData();
            if (this.currentSprintData.length === 0 && this.previousSprintData.length === 0) {
                if (window.Toast) {
                    window.Toast.info('No data available. Please check your configuration and ensure you have work items.');
                }
            }
            this.render();
        } catch (error) {
            console.error('Error initializing reports:', error);
            if (window.Toast) {
                window.Toast.error('Failed to initialize reports: ' + error.message);
            }
        }
    }

    // Load data
    async loadData() {
        try {
            showLoading(true);
            this.currentSprintData = await adoService.fetchCurrentSprint();
            this.previousSprintData = await adoService.fetchPreviousSprint();
            console.log('Reports data loaded:', {
                currentSprint: this.currentSprintData.length,
                previousSprint: this.previousSprintData.length
            });
        } catch (error) {
            console.error('Error loading reports data:', error);
            if (window.Toast) {
                window.Toast.error('Failed to load reports data: ' + error.message);
            }
            this.currentSprintData = [];
            this.previousSprintData = [];
        } finally {
            showLoading(false);
        }
    }

    // Render all charts
    render() {
        try {
            this.renderVelocityChart();
            this.renderBurndownChart();
            this.renderDistributionChart();
            this.renderPriorityChart();
        } catch (error) {
            console.error('Error rendering reports:', error);
            if (window.Toast) {
                window.Toast.error('Error rendering charts: ' + error.message);
            }
        }
    }

    // Render velocity chart
    renderVelocityChart() {
        const canvas = document.getElementById('velocityChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.charts.velocity && typeof this.charts.velocity.destroy === 'function') {
            this.charts.velocity.destroy();
        }

        const currentStats = adoService.getSummaryStats(this.currentSprintData);
        const previousStats = adoService.getSummaryStats(this.previousSprintData);

        // Calculate story points completed
        const currentPoints = this.currentSprintData
            .filter(item => ['Closed', 'Done', 'Completed'].includes(item.state))
            .reduce((sum, item) => sum + (item.storyPoints || 0), 0);

        const previousPoints = this.previousSprintData
            .filter(item => ['Closed', 'Done', 'Completed'].includes(item.state))
            .reduce((sum, item) => sum + (item.storyPoints || 0), 0);

        this.charts.velocity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Previous Sprint', 'Current Sprint'],
                datasets: [
                    {
                        label: 'Story Points Completed',
                        data: [previousPoints, currentPoints],
                        backgroundColor: '#0078d4',
                        borderColor: '#005a9e',
                        borderWidth: 1
                    },
                    {
                        label: 'Items Completed',
                        data: [previousStats.completed, currentStats.completed],
                        backgroundColor: '#107c10',
                        borderColor: '#0b5a08',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Render burndown chart
    renderBurndownChart() {
        const canvas = document.getElementById('burndownChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.charts.burndown && typeof this.charts.burndown.destroy === 'function') {
            this.charts.burndown.destroy();
        }

        const stats = adoService.getSummaryStats(this.currentSprintData);
        const totalItems = stats.total;
        const completedItems = stats.completed;
        const remainingItems = totalItems - completedItems;

        // Simulate burndown over time (in a real scenario, you'd have historical data)
        const days = 14; // Typical 2-week sprint
        const idealBurndown = [];
        const actualBurndown = [];

        for (let i = 0; i <= days; i++) {
            idealBurndown.push(totalItems - (totalItems / days) * i);
            // Simulate actual progress (this would come from historical data)
            if (i <= days - 1) {
                actualBurndown.push(totalItems - (completedItems / (days - 1)) * i);
            } else {
                actualBurndown.push(remainingItems);
            }
        }

        this.charts.burndown = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: days + 1 }, (_, i) => `Day ${i}`),
                datasets: [
                    {
                        label: 'Ideal Burndown',
                        data: idealBurndown,
                        borderColor: '#107c10',
                        backgroundColor: 'rgba(16, 124, 16, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.1
                    },
                    {
                        label: 'Actual Burndown',
                        data: actualBurndown,
                        borderColor: '#0078d4',
                        backgroundColor: 'rgba(0, 120, 212, 0.1)',
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Remaining Items'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Sprint Days'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Render distribution chart
    renderDistributionChart() {
        const canvas = document.getElementById('distributionChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.charts.distribution && typeof this.charts.distribution.destroy === 'function') {
            this.charts.distribution.destroy();
        }

        const stats = adoService.getSummaryStats(this.currentSprintData);
        const assignees = Object.keys(stats.byAssignee);
        const counts = Object.values(stats.byAssignee);

        // Generate colors
        const colors = assignees.map((_, i) => {
            const hue = (i * 137.5) % 360; // Golden angle for color distribution
            return `hsl(${hue}, 70%, 50%)`;
        });

        this.charts.distribution = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: assignees,
                datasets: [{
                    data: counts,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    // Render priority chart
    renderPriorityChart() {
        const canvas = document.getElementById('priorityChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.charts.priority && typeof this.charts.priority.destroy === 'function') {
            this.charts.priority.destroy();
        }

        const stats = adoService.getSummaryStats(this.currentSprintData);
        const priorities = ['1', '2', '3', '4'];
        const counts = priorities.map(p => stats.byPriority[p] || 0);
        const colors = priorities.map(p => PRIORITY_COLORS[p]);

        this.charts.priority = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: priorities.map(p => `Priority ${p}`),
                datasets: [{
                    label: 'Work Items',
                    data: counts,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace(')', ', 0.8)').replace('rgb', 'rgba')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Refresh all charts
    async refresh() {
        await this.loadData();
        this.render();
    }
}

// Create and expose global instance
const reports = new Reports();
window.reports = reports;
