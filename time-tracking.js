// Time Tracking Module
class TimeTracking {
    constructor() {
        this.workItems = [];
    }

    // Initialize time tracking
    async init() {
        await this.loadData();
        this.render();
    }

    // Load data
    async loadData() {
        try {
            showLoading(true);
            this.workItems = await adoService.fetchCurrentSprint();
        } catch (error) {
            console.error('Error loading time tracking data:', error);
            showError('Failed to load time tracking data.');
        } finally {
            showLoading(false);
        }
    }

    // Render time tracking
    render() {
        this.renderSummary();
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

    // Render time table
    renderTimeTable() {
        const timeTable = document.getElementById('timeTable');
        
        // Filter items with time tracking
        const itemsWithTime = this.workItems.filter(item => 
            item.originalEstimate > 0 || item.completedWork > 0 || item.remainingWork > 0
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
                        <th>Original Est.</th>
                        <th>Completed</th>
                        <th>Remaining</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsWithTime.map(item => this.renderTimeRow(item)).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="4"><strong>Total</strong></td>
                        <td><strong>${this.sumField(itemsWithTime, 'originalEstimate')}h</strong></td>
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
                <td>${item.originalEstimate || 0}h</td>
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
