// Kanban Board Module
class KanbanBoard {
    constructor() {
        this.workItems = [];
        this.filteredItems = [];
        this.searchTerm = '';
        this.filterType = 'all';
    }

    // Initialize Kanban board
    async init() {
        await this.loadData();
        this.setupEventListeners();
    }

    // Setup event listeners
    setupEventListeners() {
        const searchInput = document.getElementById('kanbanSearch');
        const filterSelect = document.getElementById('kanbanFilter');

        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.applyFilters();
        });

        filterSelect.addEventListener('change', (e) => {
            this.filterType = e.target.value;
            this.applyFilters();
        });
    }

    // Load data
    async loadData() {
        try {
            showLoading(true);
            this.workItems = await adoService.fetchCurrentSprint();
            this.filteredItems = [...this.workItems];
            this.render();
        } catch (error) {
            console.error('Error loading Kanban data:', error);
            showError('Failed to load Kanban board data.');
        } finally {
            showLoading(false);
        }
    }

    // Apply filters
    applyFilters() {
        this.filteredItems = this.workItems.filter(item => {
            // Type filter
            if (this.filterType !== 'all' && item.type !== this.filterType) {
                return false;
            }

            // Search filter
            if (this.searchTerm) {
                const searchableText = `${item.title} ${item.assignedTo} ${item.tags}`.toLowerCase();
                if (!searchableText.includes(this.searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.render();
    }

    // Render Kanban board
    render() {
        const kanbanBoard = document.getElementById('kanbanBoard');
        const groupedItems = adoService.groupByState(this.filteredItems);

        kanbanBoard.innerHTML = KANBAN_COLUMNS.map(column => `
            <div class="kanban-column" data-column="${column.id}">
                <div class="kanban-header">
                    <h3>${column.title}</h3>
                    <span class="item-count">${groupedItems[column.id].length}</span>
                </div>
                <div class="kanban-items" data-column="${column.id}">
                    ${groupedItems[column.id].map(item => this.renderKanbanCard(item)).join('')}
                </div>
            </div>
        `).join('');

        this.setupDragAndDrop();
    }

    // Render Kanban card
    renderKanbanCard(item) {
        const priorityColor = PRIORITY_COLORS[item.priority] || '#666';
        const typeColor = WORK_ITEM_COLORS[item.type] || '#666';

        return `
            <div class="kanban-card" draggable="true" data-id="${item.id}">
                <div class="card-header">
                    <span class="card-id">#${item.id}</span>
                    ${item.blocked ? '<span class="blocked-badge"><i class="fas fa-ban"></i> Blocked</span>' : ''}
                </div>
                <h4 class="card-title">${this.escapeHtml(item.title)}</h4>
                <div class="card-meta">
                    <span class="card-type" style="background: ${typeColor}">
                        ${item.type}
                    </span>
                    <span class="card-priority" style="border-left: 3px solid ${priorityColor}">
                        P${item.priority}
                    </span>
                </div>
                <div class="card-footer">
                    <span class="card-assignee" title="${this.escapeHtml(item.assignedTo)}">
                        <i class="fas fa-user"></i> ${this.getInitials(item.assignedTo)}
                    </span>
                    ${item.storyPoints ? `<span class="card-points"><i class="fas fa-chart-line"></i> ${item.storyPoints}</span>` : ''}
                    ${item.remainingWork ? `<span class="card-hours"><i class="fas fa-clock"></i> ${item.remainingWork}h</span>` : ''}
                </div>
                <a href="${item.webUrl}" target="_blank" class="card-link" title="Open in ADO">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `;
    }

    // Setup drag and drop
    setupDragAndDrop() {
        const cards = document.querySelectorAll('.kanban-card');
        const columns = document.querySelectorAll('.kanban-items');

        cards.forEach(card => {
            card.addEventListener('dragstart', this.handleDragStart.bind(this));
            card.addEventListener('dragend', this.handleDragEnd.bind(this));
        });

        columns.forEach(column => {
            column.addEventListener('dragover', this.handleDragOver.bind(this));
            column.addEventListener('drop', this.handleDrop.bind(this));
            column.addEventListener('dragleave', this.handleDragLeave.bind(this));
        });
    }

    // Drag event handlers
    handleDragStart(e) {
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
    }

    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.currentTarget.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        e.preventDefault();

        e.currentTarget.classList.remove('drag-over');

        const draggingCard = document.querySelector('.dragging');
        if (draggingCard) {
            e.currentTarget.appendChild(draggingCard);
            
            // Show notification about state change
            const workItemId = draggingCard.dataset.id;
            const newColumn = e.currentTarget.dataset.column;
            const columnName = KANBAN_COLUMNS.find(col => col.id === newColumn)?.title;
            
            showNotification(`Work item #${workItemId} moved to ${columnName}. Note: This is a visual change only. Update the state in ADO to persist.`);
        }

        return false;
    }

    // Get initials from name
    getInitials(name) {
        if (!name || name === 'Unassigned') return 'UN';
        return name.split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const kanbanBoard = new KanbanBoard();
