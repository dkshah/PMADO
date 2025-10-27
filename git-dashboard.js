class GitDashboard {
    constructor() {
        this.commits = [];
        this.teamMembers = [];
        this.commitStats = {};
        this.timeframe = 14; // Default to current sprint (14 days)
        this.commitDetails = {}; // Store commit details for the modal
        
        // Initialize event listeners
        this.initializeEventListeners();
    }

    async init() {
        await this.loadConfig();
        await this.loadData();
        this.render();
    }
    
    initializeEventListeners() {
        // Timeframe selector
        const commitTimeframe = document.getElementById('commitTimeframe');
        if (commitTimeframe) {
            commitTimeframe.addEventListener('change', (e) => {
                this.timeframe = parseInt(e.target.value);
                this.loadData();
            });
        }
        
        // Refresh button
        const refreshButton = document.getElementById('refreshCommits');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.loadData());
        }
        
        // Modal close button
        const modal = document.getElementById('commitDetailsModal');
        if (modal) {
            const closeButton = modal.querySelector('.close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            // Close modal when clicking outside
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    }

    async loadConfig() {
        // Load from app config
        const appConfig = JSON.parse(localStorage.getItem('adoConfig') || '{}');
        const gitConfig = appConfig.gitConfig || {};
        
        this.config = {
            gitAccount: appConfig.organizationUrl?.split('/').pop() || '',
            repository: gitConfig.repository || '',
            defaultBranch: gitConfig.defaultBranch || 'main',
            developmentBranch: gitConfig.developmentBranch || 'develop',
            teamMembers: gitConfig.teamMembers || [],
            currentSprint: adoService.getCurrentSprintDates(),
            organizationUrl: appConfig.organizationUrl || ''
        };
        
        // Map team members to email for easier lookup
        this.teamMemberEmails = new Map(
            this.config.teamMembers.map(member => [member.email.toLowerCase(), {
                name: member.name,
                id: member.id || member.email.split('@')[0].toLowerCase()
            }])
        );
    }

    async loadData() {
        const loadingElement = document.querySelector('#git .loading-state');
        try {
            showLoading(true);
            if (loadingElement) loadingElement.style.display = 'flex';
            
            // Load commits for selected timeframe
            this.commits = await this.fetchCommitHistory(this.timeframe);
            
            // Process commit data by team member and date
            this.processCommitData();
            
            // Render the commit table
            this.renderCommitTable();
            
        } catch (error) {
            console.error('Error loading Git data:', error);
            showError('Failed to load Git data. Please check console for details.');
        } finally {
            showLoading(false);
            if (loadingElement) loadingElement.style.display = 'none';
        }
    }

    async fetchPullRequests() {
        // This is a placeholder - actual implementation will use ADO REST API
        const response = await fetch(`${ADO_CONFIG.organization}/${this.config.gitAccount}/_apis/git/repositories/${this.config.repository}/pullrequests?api-version=7.0`);
        if (!response.ok) {
            throw new Error('Failed to fetch pull requests');
        }
        const data = await response.json();
        return data.value || [];
    }

    async fetchCommitHistory(days = 14) {
        if (!this.config.repository) {
            console.warn('No repository configured');
            return [];
        }

        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - days);
        
        try {
            // This is a placeholder - actual implementation will use ADO REST API
            const response = await fetch(
                `${this.config.organizationUrl}/${this.config.gitAccount}/_apis/git/repositories/${this.config.repository}/commits?` +
                `searchCriteria.fromDate=${fromDate.toISOString()}&` +
                `searchCriteria.toDate=${toDate.toISOString()}&` +
                `api-version=7.0`,
                {
                    headers: {
                        'Authorization': `Basic ${btoa(':' + ADO_CONFIG.personalAccessToken)}`
                    }
                }
            );
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to fetch commit history: ${response.status} ${response.statusText} - ${error}`);
            }
            
            const data = await response.json();
            return data.value || [];
            
        } catch (error) {
            console.error('Error fetching commit history:', error);
            showError(`Error fetching commits: ${error.message}`);
            return [];
        }
    }

    processCommitData() {
        // Reset commit stats and details
        this.commitStats = {};
        this.commitDetails = {};
        
        // Get all dates in the selected timeframe
        const dates = [];
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - this.timeframe);
        
        // Generate date strings for the selected timeframe
        for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dates.push(dateStr);
        }
        
        // Initialize commit stats for each team member with all dates set to 0
        this.teamMemberEmails.forEach((member, email) => {
            this.commitStats[email] = {
                id: member.id,
                name: member.name,
                email: email,
                commits: 0,
                days: {}
            };
            
            // Initialize all dates with 0 commits
            dates.forEach(date => {
                this.commitStats[email].days[date] = [];
            });
        });
        
        // Process each commit and group by author and date
        this.commits.forEach(commit => {
            const email = commit.author?.email?.toLowerCase() || 'unknown@example.com';
            const author = this.teamMemberEmails.get(email) || { name: email.split('@')[0], id: email.split('@')[0] };
            const date = new Date(commit.author?.date).toISOString().split('T')[0];
            
            // Initialize author if not exists
            if (!this.commitStats[email]) {
                this.commitStats[email] = {
                    id: author.id,
                    name: author.name,
                    email: email,
                    commits: 0,
                    days: {}
                };
                
                // Initialize all dates with empty arrays
                dates.forEach(d => {
                    this.commitStats[email].days[d] = [];
                });
            }
            
            // Add commit to the author's day
            if (!this.commitStats[email].days[date]) {
                this.commitStats[email].days[date] = [];
            }
            
            this.commitStats[email].commits++;
            this.commitStats[email].days[date].push(commit);
            
            // Store commit details for the modal
            this.commitDetails[commit.commitId] = {
                id: commit.commitId,
                message: commit.comment || 'No commit message',
                author: commit.author?.name || 'Unknown',
                date: commit.author?.date ? new Date(commit.author.date).toLocaleString() : 'Unknown',
                url: commit.url || '#',
                workItems: commit.workItems || []
            };
        });
        
        // Convert to array and sort by commit count
        this.teamMembers = Object.values(this.commitStats)
            .sort((a, b) => b.commits - a.commits);
            
        return {
            dates: dates,
            stats: this.commitStats,
            teamMembers: this.teamMembers
        };
    }

    render() {
        this.renderCommitTable();
    }

    renderCommitTable() {
        const container = document.getElementById('commitTableBody');
        const thead = document.querySelector('.commit-table thead tr');
        
        if (!container || !thead) return;
        
        // Get all unique dates from the data
        const allDates = [];
        const dateSet = new Set();
        
        // Collect all unique dates from all team members
        Object.values(this.commitStats).forEach(member => {
            Object.keys(member.days || {}).forEach(date => {
                if (!dateSet.has(date)) {
                    dateSet.add(date);
                    allDates.push(date);
                }
            });
        });
        
        // Sort dates chronologically
        allDates.sort((a, b) => new Date(a) - new Date(b));
        
        // Create table header with dates
        thead.innerHTML = '<th>Developer</th>' + 
            allDates.map(date => {
                const d = new Date(date);
                return `<th>${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</th>`;
            }).join('') + '<th>Total</th>';
        
        // Create table rows for each team member
        container.innerHTML = this.teamMembers.map(member => {
            const totalCommits = member.commits || 0;
            
            // Create cells for each date
            const dateCells = allDates.map(date => {
                const commits = member.days[date] || [];
                const commitCount = commits.length;
                const commitIds = commits.map(c => c.commitId).join(',');
                
                return `<td>
                    ${commitCount > 0 ? 
                        `<span class="commit-count has-commits" 
                              data-commits="${commitIds}" 
                              data-date="${date}" 
                              data-author="${member.email}">
                            ${commitCount}
                        </span>` : 
                        '<span class="commit-count">0</span>'
                    }
                </td>`;
            }).join('');
            
            // Create the row
            return `
                <tr>
                    <td class="developer-name">
                        <div class="developer-avatar" style="background-color: ${this.getRandomColor(member.email)}">
                            ${member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span>${member.name}</span>
                    </td>
                    ${dateCells}
                    <td class="total-commits">${totalCommits}</td>
                </tr>
            `;
        }).join('');
        
        // Add event listeners to commit count cells
        container.querySelectorAll('.commit-count.has-commits').forEach(cell => {
            cell.addEventListener('click', (e) => this.showCommitDetails(e.target));
        });
    }
    
    showCommitDetails(element) {
        const commitIds = element.getAttribute('data-commits').split(',');
        const date = element.getAttribute('data-date');
        const author = element.getAttribute('data-author');
        const member = this.teamMemberEmails.get(author) || { name: author };
        
        // Get commit details
        const commits = commitIds.map(id => this.commitDetails[id]).filter(Boolean);
        
        if (commits.length === 0) return;
        
        // Format date for display
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Create commit details HTML
        const commitItems = commits.map(commit => {
            // Extract work item IDs from commit message (e.g., #1234)
            const workItemMatches = commit.message.match(/#(\d+)/g) || [];
            const workItems = [...new Set(workItemMatches)]; // Remove duplicates
            
            return `
                <div class="commit-detail-item">
                    <div class="commit-message">${commit.message}</div>
                    <div class="commit-meta">
                        <span>${commit.author}</span>
                        <span>${commit.date}</span>
                        ${commit.url ? `<a href="${commit.url}" target="_blank" class="commit-link">View Commit</a>` : ''}
                    </div>
                    ${workItems.length > 0 ? `
                        <div class="work-items">
                            ${workItems.map(item => {
                                const itemId = item.replace('#', '');
                                return `<a href="${this.config.organizationUrl}/_workitems/edit/${itemId}" 
                                          target="_blank" 
                                          class="work-item-link">
                                    ${item}
                                </a>`;
                            }).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Update modal content
        const modal = document.getElementById('commitDetailsModal');
        const modalContent = document.getElementById('commitDetailsContent');
        
        if (modal && modalContent) {
            modalContent.innerHTML = `
                <h4>${member.name}'s Commits on ${formattedDate}</h4>
                <div class="commit-list">
                    ${commits.length > 0 ? commitItems : '<p class="no-commits">No commits found for this day.</p>'}
                </div>
            `;
            
            // Show the modal
            modal.style.display = 'flex';
        }
    }
    
    initCommitChart(canvasId, labels, datasets) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                }
            }
        });
    }
    
    getVoteStatus(vote) {
        if (vote > 0) return 'Approved';
        if (vote < 0) return 'Rejected';
        return 'No vote';
    }
     getRandomColor(str, opacity = 0.2) {
        // Generate a consistent color based on the string
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash % 360);
        return `hsla(${hue}, 70%, 50%, ${opacity})`;
    }
    
    getLastCommitDate(days) {
        if (!days) return null;
        const dates = Object.keys(days).sort();
        return dates.length > 0 ? dates[dates.length - 1] : null;
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    formatRelativeDate(dateString) {
        if (!dateString) return 'No commits';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
        return this.formatDate(dateString);
    }
    
    getVoteStatus(vote) {
        if (vote > 0) return 'Approved';
        if (vote < 0) return 'Rejected';
        return 'No vote';
    }
}


// Initialize dashboard when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.gitDashboard = new GitDashboard();
        gitDashboard.init();
    });
} else {
    window.gitDashboard = new GitDashboard();
    gitDashboard.init();
}
