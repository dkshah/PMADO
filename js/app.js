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

    // Switch tab
    async switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons and sidebar items
        document.querySelectorAll('.tab-btn, .sidebar-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        // Update breadcrumb
        const breadcrumbPage = document.getElementById('currentPage');
        if (breadcrumbPage) {
            const pageNames = {
                'dashboard': 'Dashboard',
                'kanban': 'Kanban Board',
                'reports': 'Reports',
                'time': 'Time Tracking',
                'settings': 'Settings'
            };
            breadcrumbPage.textContent = pageNames[tabName] || 'Dashboard';
        }

        // Initialize tab content if needed
        if (this.initialized) {
            await this.loadTabData(tabName);
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

    // Add a new team member row
    addTeamMember(name = '', email = '') {
        const container = document.getElementById('teamMembersContainer');
        if (!container) return;

        const memberHtml = `
            <div class="team-member-entry">
                <input type="text" class="member-name" placeholder="Display Name" value="${name}" style="width: 35%;">
                <input type="email" class="member-email" placeholder="Git Email" value="${email}" style="width: 60%;">
                <button type="button" class="btn-icon remove-member" title="Remove member">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', memberHtml);
    }

    // Show configuration modal
    showConfigModal() {
        const modal = document.getElementById('configModal');
        modal.style.display = 'flex';

        // Populate form with existing config
        if (this.config) {
            // Azure DevOps settings
            document.getElementById('orgUrl').value = this.config.organizationUrl || '';
            document.getElementById('projectName').value = this.config.projectName || '';
            document.getElementById('pat').value = this.config.personalAccessToken || '';
            document.getElementById('currentSprintQuery').value = this.config.queries?.currentSprint || '';
            document.getElementById('previousSprintQuery').value = this.config.queries?.previousSprint || '';
            document.getElementById('futureReleaseQuery').value = this.config.queries?.futureRelease || '';
            
            // Git settings
            document.getElementById('gitRepoName').value = this.config.gitConfig?.repository || '';
            document.getElementById('gitDefaultBranch').value = this.config.gitConfig?.defaultBranch || 'main';
            document.getElementById('gitDevBranch').value = this.config.gitConfig?.developmentBranch || 'develop';
            
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
        } else {
            // Add one empty row by default when no config exists
            this.addTeamMember();
        }

        // Load Hugging Face API key
        const savedHfKey = localStorage.getItem('hfApiKey');
        if (savedHfKey) {
            document.getElementById('hfApiKeyModal').value = savedHfKey;
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

        const config = {
            organizationUrl: document.getElementById('orgUrl').value.trim(),
            projectName: document.getElementById('projectName').value.trim(),
            personalAccessToken: document.getElementById('pat').value.trim(),
            queries: {
                currentSprint: document.getElementById('currentSprintQuery').value.trim(),
                previousSprint: document.getElementById('previousSprintQuery').value.trim(),
                futureRelease: document.getElementById('futureReleaseQuery').value.trim()
            },
            gitConfig: {
                repository: document.getElementById('gitRepoName').value.trim(),
                defaultBranch: document.getElementById('gitDefaultBranch').value.trim() || 'main',
                developmentBranch: document.getElementById('gitDevBranch').value.trim() || 'develop',
                teamMembers: teamMembers
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

        showNotification('Configuration saved successfully');
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
            showNotification('Dashboard loaded successfully');
        } catch (error) {
            console.error('Error initializing modules:', error);
            showError('Failed to load dashboard. Please check your configuration and try again.');
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
