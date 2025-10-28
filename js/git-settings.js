class GitSettings {
    constructor() {
        this.settings = this.loadSettings();
    }

    loadSettings() {
        const defaultSettings = {
            gitProvider: 'github', // 'github' or 'azure'
            // GitHub settings
            github: {
                username: '',
                token: '',
                repository: ''
            },
            // Azure DevOps settings
            azure: {
                organization: '',
                project: '',
                repository: '',
                pat: ''
            },
            // Common settings
            branch: 'main',
            teamMembers: []
        };

        const savedSettings = localStorage.getItem('gitSettings');
        return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    }

    saveSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        localStorage.setItem('gitSettings', JSON.stringify(this.settings));
        this.triggerSettingsUpdate();
    }

    getSettings() {
        return { ...this.settings };
    }

    getCurrentProviderSettings() {
        return this.settings[this.settings.gitProvider];
    }

    isGitHub() {
        return this.settings.gitProvider === 'github';
    }

    isAzureDevOps() {
        return this.settings.gitProvider === 'azure';
    }

    getAuthHeaders() {
        if (this.isGitHub()) {
            return {
                'Authorization': `token ${this.settings.github.token}`,
                'Accept': 'application/vnd.github.v3+json'
            };
        } else {
            return {
                'Authorization': `Basic ${btoa(':' + this.settings.azure.pat)}`,
                'Content-Type': 'application/json'
            };
        }
    }

    getApiBaseUrl() {
        if (this.isGitHub()) {
            return 'https://api.github.com';
        } else {
            return `https://dev.azure.com/${this.settings.azure.organization}/${this.settings.azure.project}/_apis/git`;
        }
    }

    getRepositoryUrl() {
        if (this.isGitHub()) {
            return `https://github.com/${this.settings.github.username}/${this.settings.github.repository}`;
        } else {
            return `https://dev.azure.com/${this.settings.azure.organization}/${this.settings.azure.project}/_git/${this.settings.azure.repository}`;
        }
    }

    // Event handling for settings changes
    onSettingsUpdate(callback) {
        this._settingsUpdateCallback = callback;
    }

    triggerSettingsUpdate() {
        if (this._settingsUpdateCallback) {
            this._settingsUpdateCallback(this.settings);
        }
    }
}

// Create and export a singleton instance
const gitSettings = new GitSettings();
window.gitSettings = gitSettings; // Make it globally available if needed

export default gitSettings;
