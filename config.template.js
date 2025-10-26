// Azure DevOps Configuration Template
// Copy this file to 'config.js' and fill in your actual values
// IMPORTANT: Never commit config.js with your PAT to version control

const ADO_CONFIG = {
    // Your Azure DevOps organization URL
    // Example: 'https://dev.azure.com/mycompany'
    organizationUrl: 'https://dev.azure.com/YOUR_ORGANIZATION',
    
    // Your project name (case-sensitive)
    // Example: 'MyProject'
    projectName: 'YOUR_PROJECT_NAME',
    
    // Personal Access Token (PAT) with Work Items Read permission
    // Leave empty to be prompted on first load
    // To create: Azure DevOps → User Settings → Personal Access Tokens
    personalAccessToken: '',
    
    // Query IDs for different sprints/releases
    // To find: Boards → Queries → Open query → Copy ID from URL
    queries: {
        // Query for current sprint work items
        currentSprint: 'CURRENT_SPRINT_QUERY_ID',
        
        // Query for previous sprint work items
        previousSprint: 'PREVIOUS_SPRINT_QUERY_ID',
        
        // Query for future release work items
        futureRelease: 'FUTURE_RELEASE_QUERY_ID'
    },
    
    // Azure DevOps REST API version (don't change unless needed)
    apiVersion: '7.0',
    
    // Refresh interval in milliseconds (default: 5 minutes)
    // Set to 0 to disable auto-refresh
    refreshInterval: 300000,
    
    // Enable debug logging in browser console
    debug: false
};

// Kanban board column configuration
// Customize these to match your team's workflow
const KANBAN_COLUMNS = [
    { 
        id: 'new', 
        title: 'New', 
        states: ['New', 'To Do'] 
    },
    { 
        id: 'active', 
        title: 'Active', 
        states: ['Active', 'In Progress', 'Committed'] 
    },
    { 
        id: 'resolved', 
        title: 'Resolved', 
        states: ['Resolved', 'Ready for Test'] 
    },
    { 
        id: 'closed', 
        title: 'Closed', 
        states: ['Closed', 'Done'] 
    }
];

// Work item type colors
// Customize these to match your preferences
const WORK_ITEM_COLORS = {
    'Bug': '#e81123',
    'Task': '#00bcf2',
    'User Story': '#009ccc',
    'Feature': '#773b93',
    'Epic': '#ff8c00',
    'Issue': '#cc293d',
    'Test Case': '#004e8c',
    'Product Backlog Item': '#009ccc'
};

// Priority colors (1 = highest, 4 = lowest)
const PRIORITY_COLORS = {
    '1': '#e81123',  // Critical - Red
    '2': '#ff8c00',  // High - Orange
    '3': '#ffb900',  // Medium - Yellow
    '4': '#00bcf2'   // Low - Blue
};
