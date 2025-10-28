/**
 * Initializes the toast notification system by ensuring the toast container exists in the DOM.
 * This should be called when the application starts.
 */
function initToastSystem() {
    // Check if container already exists
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToastSystem);
} else {
    initToastSystem();
}

// Make it globally available
window.initToastSystem = initToastSystem;
