// Main Application Controller
class App {
    constructor() {
        this.currentTab = 'dashboard';
        this.config = null;
        this.initialized = false;
    }

    // Initialize application
    async init() {
        this.loadConfig();
        this.setupEventListeners();
        this.setupTheme();

        if (this.config) {
            await this.initializeModules();
        } else {
            this.showConfigModal();
        }
    }

    // Load configuration from localStorage
    loadConfig() {
        const savedConfig = localStorage.getItem('adoConfig');
        if (savedConfig) {
            try {
                this.config = JSON.parse(savedConfig);
                adoService.init(this.config);
            } catch (error) {
                if (window.Toast) {
                    window.Toast.error(`Error loading config: ${error.message}`);
                }
                this.config = null;
            }
        }
    }

    // Save configuration to localStorage
    saveConfig(config) {
        this.config = config;
        localStorage.setItem('adoConfig', JSON.stringify(config));
        adoService.init(config);
    }

    // Setup event listeners
    setupEventListeners() {
        // Tab navigation (both old tabs and new sidebar)
        document.querySelectorAll('.tab-btn, .sidebar-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = e.currentTarget.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            });
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showConfigModal();
        });

        // Config form
        document.getElementById('configForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleConfigSubmit();
        });

        // Add team member button
        document.getElementById('addTeamMember')?.addEventListener('click', () => {
            this.addTeamMember();
        });

        // Remove team member button (delegated)
        document.getElementById('teamMembersContainer')?.addEventListener('click', (e) => {
            if (e.target.closest('.remove-member')) {
                const memberEntry = e.target.closest('.team-member-entry');
                if (memberEntry) {
                    memberEntry.remove();
                }
            }
        });

        // Cancel button
        document.getElementById('cancelConfig')?.addEventListener('click', () => {
            document.getElementById('configModal').style.display = 'none';
        });
    }

    // Setup theme
    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    // Toggle theme
    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    // Update theme icon
    updateThemeIcon(theme) {
        const icon = document.querySelector('#themeToggle i');
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    // Switch tabs
    async switchTab(tabId) {
        try {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Remove active class from all tab buttons
            document.querySelectorAll('.tab-btn, .sidebar-nav-item').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab content
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // Add active class to selected tab button
            const tabButton = document.querySelector(`[data-tab="${tabId}"], [href*="${tabId}"]`);
            if (tabButton) {
                tabButton.classList.add('active');
            }
            
            // Initialize specific tab content if needed
            if (tabId === 'kanban' && window.kanban) {
                await window.kanban.init();
            } else if (tabId === 'reports' && window.reports) {
                await window.reports.init();
            } else if (tabId === 'time' && window.timeTracking) {
                await window.timeTracking.init();
            } else if (tabId === 'ai-summary' && window.aiSummary) {
                await window.aiSummary.init();
            } else if (tabId === 'git' && window.gitDashboard) {
                await window.gitDashboard.init();
            }
        } catch (error) {
            console.error(`Error switching to tab ${tabId}:`, error);
            if (window.Toast) {
                window.Toast.error(`Failed to load ${tabId}. Please try again.`);
            }
        }
    }

    // Load data for specific tab
    async loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                await dashboard.loadData();
                break;
            case 'kanban':
                await kanbanBoard.loadData();
                break;
            case 'reports':
                await reports.refresh();
                break;
            case 'time':
                await timeTracking.refresh();
                break;
            case 'ai-summary':
                // AI Summary is initialized on page load
                break;
        }
    }

    // Show configuration modal
    showConfigModal() {
        const modal = document.getElementById('configModal');
        if (!modal) return;

        // Show the modal
        modal.style.display = 'flex';

        // Populate form with existing config if available
        if (this.config) {
            // Azure DevOps settings
            const orgUrlEl = document.getElementById('orgUrl');
            const projectNameEl = document.getElementById('projectName');
            const patEl = document.getElementById('pat');
            const currentSprintQueryEl = document.getElementById('currentSprintQuery');
            const previousSprintQueryEl = document.getElementById('previousSprintQuery');
            const futureReleaseQueryEl = document.getElementById('futureReleaseQuery');
            
            if (orgUrlEl) orgUrlEl.value = this.config.organizationUrl || '';
            if (projectNameEl) projectNameEl.value = this.config.projectName || '';
            if (patEl) patEl.value = this.config.personalAccessToken || '';
            
            if (currentSprintQueryEl) currentSprintQueryEl.value = this.config.queries?.currentSprint || '';
            if (previousSprintQueryEl) previousSprintQueryEl.value = this.config.queries?.previousSprint || '';
            if (futureReleaseQueryEl) futureReleaseQueryEl.value = this.config.queries?.futureRelease || '';

            // Clear existing team members
            const container = document.getElementById('teamMembersContainer');
            if (container) container.innerHTML = '';
            
            // Add team members
            const teamMembers = this.config.gitConfig?.teamMembers || [];
            if (teamMembers.length > 0) {
                teamMembers.forEach(member => {
                    this.addTeamMember(member.name, member.email);
                });
            } else {
                // Add one empty row by default
                this.addTeamMember();
            }

            // Load Hugging Face API key
            const savedHfKey = localStorage.getItem('hfApiKey');
            const hfApiKeyEl = document.getElementById('hfApiKeyModal');
            if (savedHfKey && hfApiKeyEl) {
                hfApiKeyEl.value = savedHfKey;
            }
        } else {
            // Add one empty row by default when no config exists
            this.addTeamMember();
        }
    }

    // Refresh all data
    async refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.classList.add('spinning');
        
        try {
            adoService.clearCache();
            await this.loadTabData(this.currentTab);
            showNotification('Data refreshed successfully');
        } catch (error) {
            showError('Failed to refresh data');
        } finally {
            refreshBtn.classList.remove('spinning');
        }
    }

    // Handle config form submission
    async handleConfigSubmit() {
        // Collect team members
        const teamMembers = [];
        const memberEntries = document.querySelectorAll('.team-member-entry');
        memberEntries.forEach(entry => {
            const name = entry.querySelector('.member-name').value.trim();
            const email = entry.querySelector('.member-email').value.trim();
            if (name && email) {
                teamMembers.push({ name, email });
            }
        });

        // Get required fields with null checks
        const orgUrlEl = document.getElementById('orgUrl');
        const projectNameEl = document.getElementById('projectName');
        const patEl = document.getElementById('pat');
        const currentSprintQueryEl = document.getElementById('currentSprintQuery');
        const previousSprintQueryEl = document.getElementById('previousSprintQuery');
        const futureReleaseQueryEl = document.getElementById('futureReleaseQuery');
        
        // Get optional Git config fields if they exist
        const gitRepoNameEl = document.getElementById('gitRepoName');
        const gitDefaultBranchEl = document.getElementById('gitDefaultBranch');
        const gitDevBranchEl = document.getElementById('gitDevBranch');
        
        const config = {
            organizationUrl: orgUrlEl ? orgUrlEl.value.trim() : '',
            projectName: projectNameEl ? projectNameEl.value.trim() : '',
            personalAccessToken: patEl ? patEl.value.trim() : '',
            queries: {
                currentSprint: currentSprintQueryEl ? currentSprintQueryEl.value.trim() : '',
                previousSprint: previousSprintQueryEl ? previousSprintQueryEl.value.trim() : '',
                futureRelease: futureReleaseQueryEl ? futureReleaseQueryEl.value.trim() : ''
            },
            gitConfig: {
                repository: gitRepoNameEl ? gitRepoNameEl.value.trim() : '',
                defaultBranch: gitDefaultBranchEl ? (gitDefaultBranchEl.value.trim() || 'main') : 'main',
                developmentBranch: gitDevBranchEl ? (gitDevBranchEl.value.trim() || 'develop') : 'develop',
                teamMembers: teamMembers || []
            },
            apiVersion: ADO_CONFIG.apiVersion,
            refreshInterval: ADO_CONFIG.refreshInterval,
            debug: ADO_CONFIG.debug
        };

        // Save configuration
        this.saveConfig(config);

        // Save Hugging Face API key
        const hfApiKey = document.getElementById('hfApiKeyModal')?.value.trim();
        if (hfApiKey) {
            localStorage.setItem('hfApiKey', hfApiKey);
        }

        // Hide modal
        document.getElementById('configModal').style.display = 'none';

        // Initialize modules
        if (!this.initialized) {
            await this.initializeModules();
        } else {
            await this.refreshData();
        }

        if (window.Toast) {
            window.Toast.success('Configuration saved successfully');
        }
    }

    // Initialize all modules
    async initializeModules() {
        try {
            showLoading(true);
            
            await dashboard.init();
            await kanbanBoard.init();
            await reports.init();
            await timeTracking.init();
            
            this.initialized = true;
            if (window.Toast) {
                window.Toast.success('Dashboard loaded successfully');
            }
        } catch (error) {
            console.error('Error initializing modules:', error);
            if (window.Toast) {
                window.Toast.error('Failed to load dashboard. Please check your configuration and try again.');
            }
        } finally {
            showLoading(false);
        }
    }
}

// Utility functions
function showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    indicator.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Hide and remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showError(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Hide and remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    
    // Initialize AI Summary module
    if (typeof aiSummary !== 'undefined') {
        aiSummary.init();
    }
});
