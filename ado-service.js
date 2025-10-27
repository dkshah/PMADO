// Azure DevOps API Service
class ADOService {
    constructor() {
        this.config = null;
        this.cache = {
            currentSprint: null,
            previousSprint: null,
            futureRelease: null,
            lastUpdate: null
        };
    }

    // Initialize with configuration
    init(config) {
        this.config = config;
        this.baseUrl = `${config.organizationUrl}/${config.projectName}/_apis`;
    }

    // Get authorization header
    getAuthHeader() {
        const token = btoa(`:${this.config.personalAccessToken}`);
        return {
            'Authorization': `Basic ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Fetch work items from a query
    async fetchWorkItemsFromQuery(queryId) {
        try {
            // Use proxy if running on localhost, otherwise direct (won't work due to CORS)
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const queryUrl = isLocalhost 
                ? `/api/ado/${this.baseUrl}/wit/queries/${queryId}?api-version=${this.config.apiVersion}`
                : `${this.baseUrl}/wit/queries/${queryId}?api-version=${this.config.apiVersion}`;
            
            if (this.config.debug) {
                console.log('Fetching query:', queryUrl);
            }

            // Get query results
            const queryResponse = await fetch(queryUrl, {
                method: 'GET',
                headers: this.getAuthHeader()
            });

            if (!queryResponse.ok) {
                throw new Error(`Query fetch failed: ${queryResponse.statusText}`);
            }

            const queryData = await queryResponse.json();
            
            // Execute query to get work item IDs
            const wiqlUrl = `${this.baseUrl}/wit/wiql/${queryId}?api-version=${this.config.apiVersion}`;
            const wiqlResponse = await fetch(wiqlUrl, {
                method: 'GET',
                headers: this.getAuthHeader()
            });

            if (!wiqlResponse.ok) {
                throw new Error(`WIQL execution failed: ${wiqlResponse.statusText}`);
            }

            const wiqlData = await wiqlResponse.json();
            
            // Handle both flat and tree query results
            let workItemIds = [];
            
            if (wiqlData.workItemRelations && wiqlData.workItemRelations.length > 0) {
                // Tree query result - extract IDs from relations
                workItemIds = wiqlData.workItemRelations
                    .filter(relation => relation.target) // Filter out null targets (root level)
                    .map(relation => relation.target.id);
                
                // Remove duplicates (parent items may appear multiple times)
                workItemIds = [...new Set(workItemIds)];
            } else if (wiqlData.workItems && wiqlData.workItems.length > 0) {
                // Flat query result - extract IDs directly
                workItemIds = wiqlData.workItems.map(wi => wi.id);
            }
            
            if (workItemIds.length === 0) {
                return [];
            }

            // Get work item IDs
            const ids = workItemIds.join(',');
            
            // Fetch work item details
            const workItemsUrl = `${this.baseUrl}/wit/workitems?ids=${ids}&$expand=all&api-version=${this.config.apiVersion}`;
            const workItemsResponse = await fetch(workItemsUrl, {
                method: 'GET',
                headers: this.getAuthHeader()
            });

            if (!workItemsResponse.ok) {
                throw new Error(`Work items fetch failed: ${workItemsResponse.statusText}`);
            }

            const workItemsData = await workItemsResponse.json();
            return this.processWorkItems(workItemsData.value);

        } catch (error) {
            console.error('Error fetching work items:', error);
            throw error;
        }
    }

    // Process and normalize work items
    processWorkItems(workItems) {
        return workItems.map(wi => {
            const fields = wi.fields;
            return {
                id: wi.id,
                title: fields['System.Title'],
                type: fields['System.WorkItemType'],
                state: fields['System.State'],
                assignedTo: fields['System.AssignedTo']?.displayName || 'Unassigned',
                priority: fields['Microsoft.VSTS.Common.Priority'] || 3,
                tags: fields['System.Tags'] || '',
                createdDate: fields['System.CreatedDate'],
                changedDate: fields['System.ChangedDate'],
                completedWork: fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0,
                remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0,
                originalEstimate: fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || 0,
                storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
                reason: fields['System.Reason'] || '',
                description: fields['System.Description'] || '',
                blocked: this.isBlocked(fields),
                url: wi.url,
                webUrl: wi._links?.html?.href || ''
            };
        });
    }

    // Check if work item is blocked
    isBlocked(fields) {
        const state = fields['System.State'];
        const reason = fields['System.Reason'] || '';
        const tags = fields['System.Tags'] || '';
        
        return reason.toLowerCase().includes('blocked') ||
               tags.toLowerCase().includes('blocked') ||
               state === 'Blocked';
    }

    // Fetch current sprint work items
    async fetchCurrentSprint() {
        if (this.cache.currentSprint && this.isCacheValid()) {
            return this.cache.currentSprint;
        }
        
        const workItems = await this.fetchWorkItemsFromQuery(this.config.queries.currentSprint);
        this.cache.currentSprint = workItems;
        this.cache.lastUpdate = Date.now();
        return workItems;
    }

    // Fetch previous sprint work items
    async fetchPreviousSprint() {
        if (this.cache.previousSprint && this.isCacheValid()) {
            return this.cache.previousSprint;
        }
        
        const workItems = await this.fetchWorkItemsFromQuery(this.config.queries.previousSprint);
        this.cache.previousSprint = workItems;
        return workItems;
    }

    // Fetch future release work items
    async fetchFutureRelease() {
        if (this.cache.futureRelease && this.isCacheValid()) {
            return this.cache.futureRelease;
        }
        
        const workItems = await this.fetchWorkItemsFromQuery(this.config.queries.futureRelease);
        this.cache.futureRelease = workItems;
        return workItems;
    }

    // Check if cache is still valid
    isCacheValid() {
        if (!this.cache.lastUpdate) return false;
        const now = Date.now();
        return (now - this.cache.lastUpdate) < this.config.refreshInterval;
    }

    // Clear cache
    clearCache() {
        this.cache = {
            currentSprint: null,
            previousSprint: null,
            futureRelease: null,
            lastUpdate: null
        };
    }

    // Get summary statistics
    getSummaryStats(workItems) {
        const stats = {
            total: workItems.length,
            completed: 0,
            inProgress: 0,
            blocked: 0,
            byType: {},
            byPriority: {},
            byAssignee: {},
            totalHours: 0,
            completedHours: 0,
            remainingHours: 0
        };

        workItems.forEach(item => {
            // State counts
            if (['Closed', 'Done', 'Completed', 'Resolved'].includes(item.state)) {
                stats.completed++;
            } else if (['Active', 'In Progress', 'Committed'].includes(item.state)) {
                stats.inProgress++;
            }

            if (item.blocked) {
                stats.blocked++;
            }

            // By type
            stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

            // By priority
            stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;

            // By assignee
            stats.byAssignee[item.assignedTo] = (stats.byAssignee[item.assignedTo] || 0) + 1;

            // Hours
            stats.totalHours += item.originalEstimate;
            stats.completedHours += item.completedWork;
            stats.remainingHours += item.remainingWork;
        });

        stats.completionPercentage = stats.total > 0 
            ? Math.round((stats.completed / stats.total) * 100) 
            : 0;

        return stats;
    }

    // Get blocked items
    getBlockedItems(workItems) {
        return workItems.filter(item => item.blocked);
    }

    // Get recent updates (last 7 days)
    getRecentUpdates(workItems) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        return workItems
            .filter(item => new Date(item.changedDate) > sevenDaysAgo)
            .sort((a, b) => new Date(b.changedDate) - new Date(a.changedDate))
            .slice(0, 10);
    }

    // Group work items by state for Kanban
    groupByState(workItems) {
        const grouped = {};
        
        KANBAN_COLUMNS.forEach(column => {
            grouped[column.id] = workItems.filter(item => 
                column.states.includes(item.state)
            );
        });

        return grouped;
    }
}

// Create global instance
const adoService = new ADOService();
