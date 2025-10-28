// Application Configuration
// IMPORTANT: Keep this file secure and do not commit sensitive data to public repositories

const ADO_CONFIG = {
    // Azure DevOps Configuration
    azureDevOps: {
        // Your Azure DevOps organization URL (e.g., 'https://dev.azure.com/yourorg')
        organizationUrl: 'https://dev.azure.com/YOUR_ORGANIZATION',
        
        // Your project name
        projectName: 'YOUR_PROJECT_NAME',
        
        // Personal Access Token (PAT) with Work Items Read permission
        // Leave empty to be prompted on first load
        personalAccessToken: '',
        
        // Query IDs for different sprints/releases
        queries: {
            currentSprint: 'CURRENT_SPRINT_QUERY_ID',
            previousSprint: 'PREVIOUS_SPRINT_QUERY_ID',
            futureRelease: 'FUTURE_RELEASE_QUERY_ID'
        },
    },
    
    // GitHub Configuration
    github: {
        // Your GitHub username or organization name
        username: 'YOUR_GITHUB_USERNAME',
        
        // GitHub Personal Access Token with repo scope
        // Create one at: https://github.com/settings/tokens
        token: '',
        
        // Default repository (format: 'owner/repo')
        repository: 'YOUR_USERNAME/YOUR_REPOSITORY'
    },
    
    // Backward compatibility
    get organizationUrl() { return this.azureDevOps.organizationUrl; },
    get projectName() { return this.azureDevOps.projectName; },
    get personalAccessToken() { return this.azureDevOps.personalAccessToken; },
    get queries() { return this.azureDevOps.queries; },
    get githubToken() { return this.github.token; },
    
    // API version
    apiVersion: '7.0',
    
    // Refresh interval in milliseconds (default: 5 minutes)
    refreshInterval: 300000,
    
    // Enable debug logging
    debug: false
};

// State columns for Kanban board
const KANBAN_COLUMNS = [
    { id: 'new', title: 'New', states: ['New', 'To Do'] },
    { id: 'active', title: 'Active', states: ['Active', 'In Progress', 'Committed'] },
    { id: 'resolved', title: 'Resolved', states: ['Resolved', 'Ready for Test'] },
    { id: 'completed', title: 'Completed', states: ['Closed', 'Done', 'Completed'] }
];

// Work item type colors
const WORK_ITEM_COLORS = {
    'Bug': '#e81123',
    'Task': '#00bcf2',
    'User Story': '#009ccc',
    'Feature': '#773b93',
    'Epic': '#ff8c00',
    'Issue': '#cc293d',
    'Test Case': '#004e8c'
};

// Priority colors
const PRIORITY_COLORS = {
    '1': '#e81123',
    '2': '#ff8c00',
    '3': '#ffb900',
    '4': '#00bcf2'
};
