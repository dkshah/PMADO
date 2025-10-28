/**
 * Toast Notification System
 * Provides a simple way to show toast notifications in the application
 */

export function showToast(message, type = 'info', duration = 5000) {
    // Create container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = message;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => hideToast(toast);
    
    // Assemble toast
    toast.appendChild(messageEl);
    toast.appendChild(closeBtn);
    container.appendChild(toast);
    
    // Trigger reflow to enable animation
    void toast.offsetWidth;
    
    // Show toast with animation
    toast.classList.add('show');
    
    // Auto-dismiss if duration is set
    if (duration > 0) {
        setTimeout(() => hideToast(toast), duration);
    }
    
    return toast;
}

export function hideToast(toast) {
    if (!toast) return;
    
    // Start hide animation
    toast.classList.remove('show');
    toast.classList.add('hide');
    
    // Remove from DOM after animation completes
    toast.addEventListener('animationend', function onAnimationEnd() {
        toast.removeEventListener('animationend', onAnimationEnd);
        toast.remove();
    }, { once: true });
}

// Convenience methods
export const Toast = {
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    warning: (message, duration) => showToast(message, 'warning', duration),
    info: (message, duration) => showToast(message, 'info', duration)
};

// Add to window object for global access
window.Toast = Toast;
