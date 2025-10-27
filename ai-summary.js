// AI Summary Module
class AISummary {
    constructor() {
        this.queries = [
            { id: 'current', label: 'Current Sprint', queryId: '' },
            { id: 'previous', label: 'Previous Sprint', queryId: '' }
        ];
        this.hfApiKey = '';
        this.workItems = [];
    }

    // Initialize the module
    init() {
        this.loadSavedConfig();
        this.setupEventListeners();
        this.renderQueryList();
        this.updateApiKeyStatus();
    }

    // Load saved configuration
    loadSavedConfig() {
        const savedKey = localStorage.getItem('hfApiKey');
        if (savedKey) {
            this.hfApiKey = savedKey;
        }

        const savedQueries = localStorage.getItem('aiSummaryQueries');
        if (savedQueries) {
            try {
                this.queries = JSON.parse(savedQueries);
            } catch (error) {
                console.error('Error loading saved queries:', error);
            }
        } else {
            // Load from main config
            const config = JSON.parse(localStorage.getItem('adoConfig') || '{}');
            if (config.queries && config.queries.currentSprint) {
                this.queries[0].queryId = config.queries.currentSprint;
            }
            if (config.queries && config.queries.previousSprint) {
                this.queries[1].queryId = config.queries.previousSprint;
            }
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Add query button
        document.getElementById('addQueryBtn').addEventListener('click', () => {
            this.addQuery();
        });

        // Generate summary button
        document.getElementById('generateSummaryBtn').addEventListener('click', () => {
            this.generateSummary();
        });

        // Copy summary button
        document.getElementById('copySummaryBtn').addEventListener('click', () => {
            this.copySummary();
        });

        // Download summary button
        document.getElementById('downloadSummaryBtn').addEventListener('click', () => {
            this.downloadSummary();
        });

        // Regenerate summary button
        document.getElementById('regenerateSummaryBtn').addEventListener('click', () => {
            this.generateSummary();
        });

        // Open Settings button
        const openSettingsBtn = document.getElementById('openSettingsFromAI');
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                document.getElementById('settingsBtn').click();
            });
        }
    }

    // Update API key status display
    updateApiKeyStatus() {
        const statusDiv = document.getElementById('apiKeyStatus');
        if (!statusDiv) return;

        this.hfApiKey = localStorage.getItem('hfApiKey') || '';
        
        if (this.hfApiKey) {
            statusDiv.innerHTML = `
                <i class="fas fa-check-circle" style="color: #10b981;"></i>
                <span style="color: #10b981;">Hugging Face API key configured</span>
                <button id="openSettingsFromAI" class="btn btn-secondary btn-sm">
                    <i class="fas fa-cog"></i> Update Settings
                </button>
            `;
        } else {
            statusDiv.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <span>Configure your Hugging Face API key in Settings to use AI Summary</span>
                <button id="openSettingsFromAI" class="btn btn-secondary btn-sm">
                    <i class="fas fa-cog"></i> Open Settings
                </button>
            `;
        }

        // Re-attach event listener
        const openSettingsBtn = document.getElementById('openSettingsFromAI');
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                document.getElementById('settingsBtn').click();
            });
        }
    }

    // Render query list
    renderQueryList() {
        const container = document.getElementById('queryIdsList');
        container.innerHTML = '';

        this.queries.forEach((query, index) => {
            const queryItem = document.createElement('div');
            queryItem.className = 'query-item';
            queryItem.innerHTML = `
                <div class="query-item-content">
                    <input type="text" 
                           class="form-control query-label" 
                           placeholder="Query Label" 
                           value="${query.label}"
                           data-index="${index}">
                    <input type="text" 
                           class="form-control query-id" 
                           placeholder="Query ID" 
                           value="${query.queryId}"
                           data-index="${index}">
                    <button class="btn btn-icon btn-danger" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(queryItem);
        });

        // Add event listeners for inputs
        container.querySelectorAll('.query-label').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.queries[index].label = e.target.value;
                localStorage.setItem('aiSummaryQueries', JSON.stringify(this.queries));
            });
        });

        container.querySelectorAll('.query-id').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.queries[index].queryId = e.target.value;
                localStorage.setItem('aiSummaryQueries', JSON.stringify(this.queries));
            });
        });

        // Add event listeners for delete buttons
        container.querySelectorAll('.btn-danger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.removeQuery(index);
            });
        });
    }

    // Add new query
    addQuery() {
        this.queries.push({
            id: `query_${Date.now()}`,
            label: `Query ${this.queries.length + 1}`,
            queryId: ''
        });
        this.renderQueryList();
        localStorage.setItem('aiSummaryQueries', JSON.stringify(this.queries));
    }

    // Remove query
    removeQuery(index) {
        if (this.queries.length > 1) {
            this.queries.splice(index, 1);
            this.renderQueryList();
            localStorage.setItem('aiSummaryQueries', JSON.stringify(this.queries));
        } else {
            showNotification('At least one query is required', 'error');
        }
    }

    // Generate summary
    async generateSummary() {
        // Reload API key from localStorage
        this.hfApiKey = localStorage.getItem('hfApiKey') || '';
        
        // Validate inputs
        if (!this.hfApiKey) {
            showNotification('Please configure your Hugging Face API key in Settings', 'error');
            return;
        }

        const validQueries = this.queries.filter(q => q.queryId.trim() !== '');
        if (validQueries.length === 0) {
            showNotification('Please add at least one query ID', 'error');
            return;
        }

        // Show loading state
        document.getElementById('aiLoadingState').style.display = 'flex';
        document.getElementById('summaryResults').style.display = 'none';

        try {
            // Fetch work items from all queries
            this.workItems = [];
            for (const query of validQueries) {
                const items = await this.fetchWorkItems(query.queryId);
                this.workItems = this.workItems.concat(items);
            }

            // Categorize work items
            const completed = this.workItems.filter(item => 
                item.state === 'Done' || 
                item.state === 'Closed' ||
                item.state === 'Completed' ||
                item.state === 'Resolved'
            );

            const inProgress = this.workItems.filter(item => 
                item.state !== 'Done' && 
                item.state !== 'Closed' &&
                item.state !== 'Completed' &&
                item.state !== 'Resolved'
            );

            // Generate AI summaries
            const completedSummary = await this.generateAISummary(completed, 'completed');
            const inProgressSummary = await this.generateAISummary(inProgress, 'in-progress');
            const insights = await this.generateInsights(this.workItems);

            // Display results
            this.displayResults(completed, inProgress, completedSummary, inProgressSummary, insights);

            showNotification('Summary generated successfully', 'success');
        } catch (error) {
            console.error('Error generating summary:', error);
            showNotification('Error generating summary: ' + error.message, 'error');
        } finally {
            document.getElementById('aiLoadingState').style.display = 'none';
        }
    }

    // Fetch work items from ADO
    async fetchWorkItems(queryId) {
        try {
            const workItems = await adoService.fetchWorkItemsFromQuery(queryId);
            return workItems;
        } catch (error) {
            console.error('Error fetching work items:', error);
            return [];
        }
    }

    // Generate AI summary using Hugging Face
    async generateAISummary(items, type) {
        if (items.length === 0) {
            return type === 'completed' 
                ? 'No completed items in this sprint.' 
                : 'No items currently in progress.';
        }

        // Prepare context for AI
        const itemsText = items.map(item => {
            const title = item.title;
            const type = item.type;
            const state = item.state;
            const assignedTo = item.assignedTo || 'Unassigned';
            return `- ${type}: ${title} (${state}, Assigned to: ${assignedTo})`;
        }).join('\n');

        const prompt = type === 'completed'
            ? `Summarize the following completed work items in a professional sprint summary format. Focus on achievements and delivered value:\n\n${itemsText}\n\nProvide a concise summary highlighting key accomplishments:`
            : `Summarize the following in-progress work items. Focus on business stories that are not yet completed and their current status:\n\n${itemsText}\n\nProvide a concise summary of ongoing work and any potential blockers:`;

        try {
            const summary = await this.callHuggingFaceAPI(prompt);
            return summary;
        } catch (error) {
            console.error('Error calling Hugging Face API:', error);
            return `Unable to generate AI summary. ${items.length} items ${type === 'completed' ? 'completed' : 'in progress'}.`;
        }
    }

    // Generate insights
    async generateInsights(items) {
        if (items.length === 0) {
            return 'No work items to analyze.';
        }

        const completed = items.filter(item => 
            item.state === 'Done' || 
            item.state === 'Closed' ||
            item.state === 'Completed'
        ).length;

        const total = items.length;
        const completionRate = ((completed / total) * 100).toFixed(1);

        const itemsByType = {};
        items.forEach(item => {
            const type = item.type;
            itemsByType[type] = (itemsByType[type] || 0) + 1;
        });

        const prompt = `Analyze this sprint data and provide 3-5 key insights and recommendations:
        
Total Items: ${total}
Completed: ${completed} (${completionRate}%)
Items by Type: ${JSON.stringify(itemsByType)}

Provide actionable insights about team performance, potential risks, and recommendations:`;

        try {
            const insights = await this.callHuggingFaceAPI(prompt);
            return insights;
        } catch (error) {
            console.error('Error generating insights:', error);
            return `Sprint Progress: ${completionRate}% complete (${completed}/${total} items)`;
        }
    }

    // Call Hugging Face API
    async callHuggingFaceAPI(prompt) {
        const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.hfApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: 200,
                    min_length: 50,
                    do_sample: false
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data[0]?.summary_text || data[0]?.generated_text || 'Unable to generate summary';
    }

    // Display results
    displayResults(completed, inProgress, completedSummary, inProgressSummary, insights) {
        // Update counts
        document.getElementById('completedCount').textContent = `${completed.length} items completed`;
        document.getElementById('inProgressCount').textContent = `${inProgress.length} items in progress`;

        // Display completed summary
        document.getElementById('completedContent').innerHTML = `
            <div class="ai-summary-text">${this.formatSummary(completedSummary)}</div>
        `;

        // Display completed items
        document.getElementById('completedItems').innerHTML = completed.map(item => `
            <div class="work-item-card">
                <div class="work-item-header">
                    <span class="work-item-type ${item.type.toLowerCase()}">${item.type}</span>
                    <span class="work-item-id">#${item.id}</span>
                </div>
                <div class="work-item-title">${item.title}</div>
                <div class="work-item-meta">
                    <span><i class="fas fa-user"></i> ${item.assignedTo || 'Unassigned'}</span>
                    <span><i class="fas fa-check-circle"></i> ${item.state}</span>
                </div>
            </div>
        `).join('');

        // Display in-progress summary
        document.getElementById('inProgressContent').innerHTML = `
            <div class="ai-summary-text">${this.formatSummary(inProgressSummary)}</div>
        `;

        // Display in-progress items
        document.getElementById('inProgressItems').innerHTML = inProgress.map(item => `
            <div class="work-item-card">
                <div class="work-item-header">
                    <span class="work-item-type ${item.type.toLowerCase()}">${item.type}</span>
                    <span class="work-item-id">#${item.id}</span>
                </div>
                <div class="work-item-title">${item.title}</div>
                <div class="work-item-meta">
                    <span><i class="fas fa-user"></i> ${item.assignedTo || 'Unassigned'}</span>
                    <span><i class="fas fa-spinner"></i> ${item.state}</span>
                </div>
            </div>
        `).join('');

        // Display insights
        document.getElementById('insightsContent').innerHTML = `
            <div class="ai-summary-text">${this.formatSummary(insights)}</div>
        `;

        // Show results
        document.getElementById('summaryResults').style.display = 'block';
    }

    // Format summary text
    formatSummary(text) {
        return text.split('\n').map(line => {
            line = line.trim();
            if (line.startsWith('-') || line.startsWith('•')) {
                return `<li>${line.substring(1).trim()}</li>`;
            }
            return line ? `<p>${line}</p>` : '';
        }).join('');
    }

    // Copy summary to clipboard
    copySummary() {
        const completedText = document.getElementById('completedContent').innerText;
        const inProgressText = document.getElementById('inProgressContent').innerText;
        const insightsText = document.getElementById('insightsContent').innerText;

        const fullSummary = `
Sprint Summary
==============

COMPLETED
---------
${completedText}

IN PROGRESS
-----------
${inProgressText}

KEY INSIGHTS
------------
${insightsText}
        `.trim();

        navigator.clipboard.writeText(fullSummary).then(() => {
            showNotification('Summary copied to clipboard', 'success');
        }).catch(err => {
            console.error('Error copying to clipboard:', err);
            showNotification('Failed to copy summary', 'error');
        });
    }

    // Download summary as text file
    downloadSummary() {
        const completedText = document.getElementById('completedContent').innerText;
        const inProgressText = document.getElementById('inProgressContent').innerText;
        const insightsText = document.getElementById('insightsContent').innerText;

        const fullSummary = `
Sprint Summary - ${new Date().toLocaleDateString()}
${'='.repeat(50)}

COMPLETED
${'-'.repeat(50)}
${completedText}

IN PROGRESS
${'-'.repeat(50)}
${inProgressText}

KEY INSIGHTS
${'-'.repeat(50)}
${insightsText}
        `.trim();

        const blob = new Blob([fullSummary], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sprint-summary-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Summary downloaded', 'success');
    }
}

// Initialize AI Summary module
const aiSummary = new AISummary();
