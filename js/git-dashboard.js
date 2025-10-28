class GitDashboard {
    constructor() {
        this.commits = [];
        this.teamMembers = [];
        this.commitStats = {};
        this.timeframe = 14; // Default to current sprint (14 days)
        this.commitDetails = {}; // Store commit details for the modal
        this.teamMemberEmails = new Map(); // Initialize as empty Map
        
        // Initialize event listeners
        this.initializeEventListeners();
    }

    async init() {
        try {
            // Initialize Git settings if available
            if (window.gitSettings) {
                // Listen for settings changes
                window.gitSettings.onSettingsUpdate(() => {
                    this.loadConfig().then(() => this.loadData());
                });
            }
            
            await this.loadConfig();
            await this.loadData();
        } catch (error) {
            console.error('Error initializing Git dashboard:', error);
            if (window.Toast) {
                window.Toast.error(`Failed to initialize Git dashboard: ${error.message}`);
            } else {
                console.error('Toast not available:', error);
            }
        }
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
        
        // Git Settings button
        const gitSettingsBtn = document.getElementById('openGitSettings');
        if (gitSettingsBtn) {
            gitSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = document.getElementById('gitSettingsModal');
                if (modal) {
                    modal.style.display = 'block';
                    // Trigger any initialization needed for the modal
                    if (window.gitSettings && typeof window.gitSettings.openModal === 'function') {
                        window.gitSettings.openModal();
                    }
                } else {
                    console.error('Git settings modal not found');
                    if (window.Toast) {
                        window.Toast.error('Could not open Git settings. Please try refreshing the page.');
                    }
                }
            });
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
        // Load settings from GitSettings
        this.settings = window.gitSettings || {};
        
        // Backward compatibility with old config
        const appConfig = JSON.parse(localStorage.getItem('adoConfig') || '{}');
        const gitConfig = appConfig.gitConfig || {};
        
        // Fallback for when adoService is not available
        const getSprintDates = () => {
            try {
                return window.adoService?.getCurrentSprintDates?.() || {
                    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0]
                };
            } catch (e) {
                // If there's an error, default to last 14 days
                return {
                    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0]
                };
            }
        };

        // Get settings from GitSettings or fallback to config
        const settings = this.settings.getSettings ? this.settings.getSettings() : {};
        const isGitHub = settings.gitProvider === 'github';
        
        this.config = {
            // Git provider info
            isGitHub,
            gitProvider: settings.gitProvider || 'github',
            
            // Repository settings
            gitAccount: isGitHub ? (settings.github?.username || '') : (settings.azure?.organization || ''),
            repository: isGitHub ? (settings.github?.repository || '') : (settings.azure?.repository || ''),
            defaultBranch: settings.branch || 'main',
            developmentBranch: settings.developmentBranch || 'develop',
            
            // Team settings
            teamMembers: settings.teamMembers || [],
            
            // Sprint settings
            currentSprint: getSprintDates(),
            
            // URLs and API
            organizationUrl: isGitHub 
                ? `https://github.com/${settings.github?.username || ''}`
                : `https://dev.azure.com/${settings.azure?.organization || ''}`,
            apiBaseUrl: isGitHub 
                ? 'https://api.github.com'
                : `https://dev.azure.com/${settings.azure?.organization || ''}/${settings.azure?.project || ''}/_apis/git`,
            
            // Authentication
            authHeader: isGitHub 
                ? (settings.github?.token ? {
                    'Authorization': `token ${settings.github.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                } : {})
                : (settings.azure?.pat ? {
                    'Authorization': `Basic ${btoa(':' + settings.azure.pat)}`,
                    'Content-Type': 'application/json'
                } : {})
        };
        
        // Map team members to email for easier lookup
        // Handle both string emails and object format { name, email, id }
        this.teamMemberEmails = new Map();
        
        if (Array.isArray(this.config.teamMembers) && this.config.teamMembers.length > 0) {
            this.config.teamMembers.forEach(member => {
                let email, name, id;
                
                if (typeof member === 'string') {
                    // Member is just an email string
                    email = member.toLowerCase();
                    name = email.split('@')[0];
                    id = email.split('@')[0].toLowerCase();
                } else if (member && typeof member === 'object' && member.email) {
                    // Member is an object with email property
                    email = member.email.toLowerCase();
                    name = member.name || email.split('@')[0];
                    id = member.id || email.split('@')[0].toLowerCase();
                } else {
                    // Invalid member format, skip
                    return;
                }
                
                this.teamMemberEmails.set(email, { name, id });
            });
        }
    }

    async loadData() {
        const loadingElement = document.querySelector('#git .loading-state');
        const refreshButton = document.getElementById('refreshCommits');
        
        try {
            // Show loading state
            if (loadingElement) loadingElement.style.display = 'block';
            if (refreshButton) {
                refreshButton.disabled = true;
                const icon = refreshButton.querySelector('i.fa-sync-alt');
                if (icon) icon.classList.add('fa-spin');
            }
            
            if (window.Toast) {
                window.Toast.info('Loading commit data...', 3000);
            }
            if (loadingElement) loadingElement.style.display = 'flex';
            
            // Load commits for selected timeframe
            this.commits = await this.fetchCommitHistory(this.timeframe);
            
            // Process commit data by team member and date
            this.processCommitData();
            
            // Render the commit table
            this.renderCommitTable();
            
            // Update the last updated time
            this.updateLastUpdated();
            
            // Show success message
            if (window.Toast) {
                window.Toast.success(`Successfully loaded ${this.commits.length} commits`, 3000);
            }
        } catch (error) {
            console.error('Error loading commit data:', error);
            if (window.Toast) {
                window.Toast.error(`Failed to load commit data: ${error.message}`, 5000);
            } else {
                console.error('Error details:', error);
            }
        } finally {
            // Hide loading state
            if (loadingElement) loadingElement.style.display = 'none';
            
            // Re-enable refresh button
            if (refreshButton) {
                refreshButton.disabled = false;
                const icon = refreshButton.querySelector('i.fa-sync-alt');
                if (icon) icon.classList.remove('fa-spin');
            }
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
        if (!this.config.gitAccount || !this.config.repository) {
            showError('Git repository not configured. Please check your settings.');
            return [];
        }
        
        // Check if we have required auth
        if ((this.config.isGitHub && !this.config.authHeader.Authorization) || 
            (!this.config.isGitHub && !this.config.authHeader.Authorization)) {
            showError('Authentication not configured. Please check your Git settings.');
            return [];
        }

        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(toDate.getDate() - days);
        
        try {
            if (this.config.isGitHub) {
                // GitHub API implementation
                const since = fromDate.toISOString();
                const url = `${this.config.apiBaseUrl}/repos/${this.config.gitAccount}/${this.config.repository}/commits?since=${since}&per_page=100`;
                
                try {
                    const response = await fetch(url, {
                        headers: this.config.authHeader
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || 'Failed to fetch commits from GitHub');
                    }
                    
                    const commits = await response.json();
                    
                    // Transform GitHub API response to match our expected format
                    return commits.map(commit => ({
                        commitId: commit.sha,
                        message: commit.commit.message,
                        author: {
                            name: commit.commit.author?.name || commit.author?.login || 'Unknown',
                            email: commit.commit.author?.email || '',
                            date: commit.commit.author?.date
                        },
                        url: commit.html_url,
                        // Extract work items from commit message (e.g., #1234)
                        workItems: (commit.commit.message.match(/#(\d+)/g) || []).map(match => ({
                            id: match.replace('#', ''),
                            url: `${this.config.organizationUrl}/${this.config.repository}/issues/${match.replace('#', '')}`,
                            title: `Work Item ${match}`,
                            state: 'completed' // Default state for GitHub issues
                        }))
                    }));
                } catch (error) {
                    if (window.Toast) {
                        window.Toast.error(`GitHub API Error: ${error.message}`);
                    }
                    return [];
                }
            } else {
                // Original Azure DevOps implementation
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
            }
            
        } catch (error) {
            if (window.Toast) {
                window.Toast.error(`Error fetching commits: ${error.message}`);
            }
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
        if (this.teamMemberEmails && this.teamMemberEmails.size > 0) {
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
        }
        
        // Process each commit and group by author and date
        this.commits.forEach(commit => {
            const email = commit.author?.email?.toLowerCase() || 'unknown@example.com';
            const author = (this.teamMemberEmails && this.teamMemberEmails.get(email)) || { name: email.split('@')[0], id: email.split('@')[0] };
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
        const member = (this.teamMemberEmails && this.teamMemberEmails.get(author)) || { name: author };
        
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
    
    updateLastUpdated() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        if (lastUpdatedElement) {
            const now = new Date();
            lastUpdatedElement.textContent = now.toLocaleString();
        }
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
