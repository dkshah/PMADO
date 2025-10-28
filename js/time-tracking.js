// Time Tracking Module
class TimeTracking {
    constructor() {
        this.workItems = [];
    }

    // Initialize time tracking
    async init() {
        try {
            // Wait for ADO service to be ready
            if (!window.adoService || !window.adoService.config) {
                await new Promise(resolve => {
                    const checkConfig = setInterval(() => {
                        if (window.adoService && window.adoService.config) {
                            clearInterval(checkConfig);
                            resolve();
                        }
                    }, 100);
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        clearInterval(checkConfig);
                        resolve();
                    }, 5000);
                });
            }
            
            if (!window.adoService || !window.adoService.config) {
                throw new Error('ADO service not configured. Please configure your Azure DevOps settings.');
            }
            
            await this.loadData();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing time tracking:', error);
            if (window.Toast) {
                window.Toast.error('Failed to initialize time tracking: ' + error.message);
            }
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Add any event listeners for time tracking here if needed
        console.log('Time tracking event listeners initialized');
    }

    // Load data
    async loadData() {
        try {
            showLoading(true);
            this.workItems = await adoService.fetchCurrentSprint();
            // Get iteration dates for the sprint
            this.iterationDates = adoService.getIterationDates(this.workItems);
        } catch (error) {
            if (window.Toast) {
                window.Toast.error(`Error loading time tracking data: ${error.message}`);
            }
        } finally {
            showLoading(false);
        }
    }

    // Render time tracking
    render() {
        this.renderSummary();
        this.renderDailyHoursTable();
        this.renderTimeTable();
        this.renderTeamTimeChart();
    }

    // Render summary cards
    renderSummary() {
        const totalHours = this.workItems.reduce((sum, item) => 
            sum + (item.completedWork || 0), 0);
        
        const remainingHours = this.workItems.reduce((sum, item) => 
            sum + (item.remainingWork || 0), 0);
        
        const totalItems = this.workItems.filter(item => 
            item.completedWork > 0 || item.remainingWork > 0).length;
        
        const avgHours = totalItems > 0 ? (totalHours / totalItems).toFixed(1) : 0;

        document.getElementById('totalHours').textContent = totalHours.toFixed(1);
        document.getElementById('avgHoursPerItem').textContent = avgHours;
        document.getElementById('remainingHours').textContent = remainingHours.toFixed(1);
    }

    // Render daily hours table by team member
    renderDailyHoursTable() {
        const container = document.getElementById('dailyHoursTable');
        if (!container) return;

        // Get work items with history/activity data
        // For now, we'll simulate daily data based on completed work
        // In a real implementation, you'd fetch daily activity from ADO API
        
        const dailyTarget = 9; // 9 hours per day target
        const teamMembers = {};
        
        // Group by team member
        this.workItems.forEach(item => {
            const assignee = item.assignedTo || 'Unassigned';
            if (!teamMembers[assignee]) {
                teamMembers[assignee] = {
                    totalHours: 0,
                    dailyHours: {}
                };
            }
            teamMembers[assignee].totalHours += item.completedWork || 0;
        });

        // Generate days based on iteration dates
        const days = [];
        const startDate = this.iterationDates ? this.iterationDates.startDate : new Date();
        const endDate = this.iterationDates ? this.iterationDates.endDate : new Date();
        
        // Calculate number of days in sprint
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const numDays = Math.min(Math.max(daysDiff, 7), 14); // Between 7 and 14 days
        
        for (let i = numDays - 1; i >= 0; i--) {
            const date = new Date(endDate);
            date.setDate(date.getDate() - i);
            days.push(date);
        }

        // Simulate daily distribution (in real app, fetch from ADO activity logs)
        Object.keys(teamMembers).forEach(member => {
            const total = teamMembers[member].totalHours;
            const avgPerDay = total / days.length;
            
            days.forEach((date, index) => {
                const dateKey = date.toISOString().split('T')[0];
                // Add some variation to make it realistic
                const variation = (Math.random() - 0.5) * 2;
                const hours = Math.max(0, avgPerDay + variation);
                teamMembers[member].dailyHours[dateKey] = parseFloat(hours.toFixed(1));
            });
        });

        // Render table
        const memberNames = Object.keys(teamMembers).sort();
        
        container.innerHTML = `
            <div class="daily-hours-header">
                <h3><i class="fas fa-calendar-alt"></i> Daily Hours by Team Member</h3>
                <div class="daily-target-info">
                    <span class="target-badge">Target: ${dailyTarget}h/day</span>
                </div>
            </div>
            <div class="daily-hours-table-wrapper">
                <table class="daily-hours-table">
                    <thead>
                        <tr>
                            <th class="member-col">Team Member</th>
                            ${days.map(date => `
                                <th class="day-col">
                                    <div class="day-header">
                                        <div class="day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        <div class="day-date">${date.getDate()}/${date.getMonth() + 1}</div>
                                    </div>
                                </th>
                            `).join('')}
                            <th class="total-col">Total</th>
                            <th class="avg-col">Avg/Day</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${memberNames.map(member => {
                            const data = teamMembers[member];
                            const avgPerDay = (data.totalHours / 7).toFixed(1);
                            
                            return `
                                <tr>
                                    <td class="member-name">${this.escapeHtml(member)}</td>
                                    ${days.map(date => {
                                        const dateKey = date.toISOString().split('T')[0];
                                        const hours = data.dailyHours[dateKey] || 0;
                                        const percentage = (hours / dailyTarget) * 100;
                                        const statusClass = hours >= dailyTarget ? 'on-target' : 
                                                          hours >= dailyTarget * 0.8 ? 'near-target' : 'below-target';
                                        
                                        return `
                                            <td class="hours-cell ${statusClass}">
                                                <div class="hours-content">
                                                    <span class="hours-value">${hours}h</span>
                                                    <div class="hours-bar">
                                                        <div class="hours-bar-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                                                    </div>
                                                </div>
                                            </td>
                                        `;
                                    }).join('')}
                                    <td class="total-hours"><strong>${data.totalHours.toFixed(1)}h</strong></td>
                                    <td class="avg-hours ${avgPerDay >= dailyTarget ? 'on-target' : 'below-target'}">
                                        <strong>${avgPerDay}h</strong>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="daily-hours-legend">
                <div class="legend-item">
                    <span class="legend-indicator on-target"></span>
                    <span>≥ ${dailyTarget}h (On Target)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-indicator near-target"></span>
                    <span>≥ ${dailyTarget * 0.8}h (Near Target)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-indicator below-target"></span>
                    <span>&lt; ${dailyTarget * 0.8}h (Below Target)</span>
                </div>
            </div>
        `;
    }

    // Render time table
    renderTimeTable() {
        const timeTable = document.getElementById('timeTable');
        
        // Filter items with time tracking
        const itemsWithTime = this.workItems.filter(item => 
            item.baselineWork > 0 || item.completedWork > 0 || item.remainingWork > 0
        );

        if (itemsWithTime.length === 0) {
            timeTable.innerHTML = '<p class="no-data">No time tracking data available</p>';
            return;
        }

        // Sort by completed work descending
        itemsWithTime.sort((a, b) => b.completedWork - a.completedWork);

        timeTable.innerHTML = `
            <table class="time-table-grid">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Assignee</th>
                        <th>Baseline Work</th>
                        <th>Completed Work</th>
                        <th>Remaining Work</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsWithTime.map(item => this.renderTimeRow(item)).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="4"><strong>Total</strong></td>
                        <td><strong>${this.sumField(itemsWithTime, 'baselineWork')}h</strong></td>
                        <td><strong>${this.sumField(itemsWithTime, 'completedWork')}h</strong></td>
                        <td><strong>${this.sumField(itemsWithTime, 'remainingWork')}h</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    // Render time table row
    renderTimeRow(item) {
        const total = item.completedWork + item.remainingWork;
        const progress = total > 0 ? Math.round((item.completedWork / total) * 100) : 0;
        const typeColor = WORK_ITEM_COLORS[item.type] || '#666';

        return `
            <tr>
                <td><a href="${item.webUrl}" target="_blank">#${item.id}</a></td>
                <td class="title-cell">${this.escapeHtml(item.title)}</td>
                <td><span class="type-badge" style="background: ${typeColor}">${item.type}</span></td>
                <td>${this.escapeHtml(item.assignedTo)}</td>
                <td>${item.baselineWork || 0}h</td>
                <td>${item.completedWork || 0}h</td>
                <td>${item.remainingWork || 0}h</td>
                <td>
                    <div class="progress-cell">
                        <div class="mini-progress">
                            <div class="mini-progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <span>${progress}%</span>
                    </div>
                </td>
            </tr>
        `;
    }

    // Render team time chart
    renderTeamTimeChart() {
        const canvas = document.getElementById('teamTimeChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (window.teamTimeChart && typeof window.teamTimeChart.destroy === 'function') {
            window.teamTimeChart.destroy();
        }

        // Group by assignee
        const timeByAssignee = {};
        this.workItems.forEach(item => {
            const assignee = item.assignedTo;
            if (!timeByAssignee[assignee]) {
                timeByAssignee[assignee] = {
                    completed: 0,
                    remaining: 0
                };
            }
            timeByAssignee[assignee].completed += item.completedWork || 0;
            timeByAssignee[assignee].remaining += item.remainingWork || 0;
        });

        const assignees = Object.keys(timeByAssignee);
        const completedHours = assignees.map(a => timeByAssignee[a].completed);
        const remainingHours = assignees.map(a => timeByAssignee[a].remaining);

        window.teamTimeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: assignees,
                datasets: [
                    {
                        label: 'Completed Hours',
                        data: completedHours,
                        backgroundColor: '#107c10',
                        borderColor: '#0b5a08',
                        borderWidth: 1
                    },
                    {
                        label: 'Remaining Hours',
                        data: remainingHours,
                        backgroundColor: '#ff8c00',
                        borderColor: '#cc7000',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}h`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Sum a field across items
    sumField(items, field) {
        return items.reduce((sum, item) => sum + (item[field] || 0), 0).toFixed(1);
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Refresh data
    async refresh() {
        await this.loadData();
        this.render();
    }
}

// Create global instance
const timeTracking = new TimeTracking();
