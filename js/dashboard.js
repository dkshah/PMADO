// Dashboard Module
class Dashboard {
    constructor() {
        this.currentSprint = 'current';
        this.workItems = [];
    }

    // Initialize dashboard
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
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            if (window.Toast) {
                window.Toast.error('Failed to initialize dashboard: ' + error.message);
            }
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Sprint selector buttons
        document.querySelectorAll('.sprint-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sprint = e.currentTarget.dataset.sprint;
                this.switchSprint(sprint);
            });
        });
    }

    // Switch between sprints
    async switchSprint(sprint) {
        this.currentSprint = sprint;
        
        // Update active button
        document.querySelectorAll('.sprint-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sprint === sprint);
        });

        await this.loadData();
    }

    // Load data based on current sprint
    async loadData() {
        try {
            showLoading(true);

            switch (this.currentSprint) {
                case 'previous':
                    this.workItems = await adoService.fetchPreviousSprint();
                    break;
                case 'future':
                    this.workItems = await adoService.fetchFutureRelease();
                    break;
                default:
                    this.workItems = await adoService.fetchCurrentSprint();
            }

            this.render();
        } catch (error) {
            if (window.Toast) {
                window.Toast.error(`Error loading dashboard: ${error.message}`);
            }
        } finally {
            showLoading(false);
        }
    }

    // Render dashboard
    render() {
        const stats = adoService.getSummaryStats(this.workItems);
        
        this.renderSummaryCards(stats);
        this.renderProgress(stats);
        this.renderFlags();
        this.renderWorkItemsChart(stats);
        this.renderActivity();
    }

    // Render summary cards
    renderSummaryCards(stats) {
        document.getElementById('totalItems').textContent = stats.total;
        document.getElementById('completedItems').textContent = stats.completed;
        document.getElementById('inProgressItems').textContent = stats.inProgress;
        document.getElementById('blockedItems').textContent = stats.blocked;
    }

    // Render progress bar
    renderProgress(stats) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressDetails = document.getElementById('progressDetails');

        progressFill.style.width = `${stats.completionPercentage}%`;
        progressText.textContent = `${stats.completionPercentage}% Complete`;
        progressDetails.textContent = `${stats.completed} of ${stats.total} items`;
    }

    // Render flags and blockers
    renderFlags() {
        const flagsList = document.getElementById('flagsList');
        const blockedItems = adoService.getBlockedItems(this.workItems);

        if (blockedItems.length === 0) {
            flagsList.innerHTML = '<p class="no-data">No blocked items</p>';
            return;
        }

        flagsList.innerHTML = blockedItems.map(item => `
            <div class="flag-item">
                <div class="flag-icon">
                    <i class="fas fa-flag"></i>
                </div>
                <div class="flag-content">
                    <h4>${this.escapeHtml(item.title)}</h4>
                    <div class="flag-meta">
                        <span class="badge" style="background: ${WORK_ITEM_COLORS[item.type] || '#666'}">
                            ${item.type}
                        </span>
                        <span class="assignee">
                            <i class="fas fa-user"></i> ${this.escapeHtml(item.assignedTo)}
                        </span>
                        <span class="reason">${this.escapeHtml(item.reason)}</span>
                    </div>
                </div>
                <a href="${item.webUrl}" target="_blank" class="flag-link" title="Open in ADO">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `).join('');
    }

    // Render work items chart
    renderWorkItemsChart(stats) {
        const canvas = document.getElementById('workItemsCanvas');
        const ctx = canvas.getContext('2d');

        // Destroy existing chart if any
        if (window.workItemsChart && typeof window.workItemsChart.destroy === 'function') {
            window.workItemsChart.destroy();
        }

        const types = Object.keys(stats.byType);
        const counts = Object.values(stats.byType);
        const colors = types.map(type => WORK_ITEM_COLORS[type] || '#666');

        window.workItemsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: types,
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
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    // Render recent activity
    renderActivity() {
        const activityList = document.getElementById('activityList');
        const recentItems = adoService.getRecentUpdates(this.workItems);

        if (recentItems.length === 0) {
            activityList.innerHTML = '<p class="no-data">No recent updates</p>';
            return;
        }

        activityList.innerHTML = recentItems.map(item => `
            <div class="activity-item">
                <div class="activity-icon" style="background: ${WORK_ITEM_COLORS[item.type] || '#666'}">
                    <i class="fas fa-${this.getIconForType(item.type)}"></i>
                </div>
                <div class="activity-content">
                    <h4>${this.escapeHtml(item.title)}</h4>
                    <p class="activity-meta">
                        <span class="badge">${item.type}</span>
                        <span class="state">${item.state}</span>
                        <span class="assignee">${this.escapeHtml(item.assignedTo)}</span>
                    </p>
                    <p class="activity-time">${this.formatRelativeTime(item.changedDate)}</p>
                </div>
            </div>
        `).join('');
    }

    // Get icon for work item type
    getIconForType(type) {
        const icons = {
            'Bug': 'bug',
            'Task': 'tasks',
            'User Story': 'book',
            'Feature': 'star',
            'Epic': 'mountain',
            'Issue': 'exclamation-circle',
            'Test Case': 'vial'
        };
        return icons[type] || 'circle';
    }

    // Format relative time
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const dashboard = new Dashboard();
