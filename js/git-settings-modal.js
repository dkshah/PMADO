document.addEventListener('DOMContentLoaded', () => {
    // Initialize elements
    const modal = document.getElementById('gitSettingsModal');
    const closeBtn = modal.querySelector('.close');
    const form = document.getElementById('gitSettingsForm');
    const providerRadios = document.querySelectorAll('input[name="gitProvider"]');
    const githubSettings = document.getElementById('githubSettings');
    const azureSettings = document.getElementById('azureSettings');
    const testConnectionBtn = document.getElementById('testConnectionBtn');

    // Toggle provider settings based on selection
    function updateProviderSettings() {
        const provider = document.querySelector('input[name="gitProvider"]:checked').value;
        githubSettings.style.display = provider === 'github' ? 'block' : 'none';
        azureSettings.style.display = provider === 'azure' ? 'block' : 'none';
    }

    // Load saved settings
    function loadSettings() {
        const settings = window.gitSettings.getSettings();
        
        // Set provider
        const provider = settings.gitProvider || 'github';
        document.querySelector(`input[name="gitProvider"][value="${provider}"]`).checked = true;
        
        // Set GitHub settings
        if (settings.github) {
            document.getElementById('githubUsername').value = settings.github.username || '';
            document.getElementById('githubToken').value = settings.github.token || '';
            document.getElementById('githubRepo').value = settings.github.repository || '';
        }
        
        // Set Azure DevOps settings
        if (settings.azure) {
            document.getElementById('azureOrg').value = settings.azure.organization || '';
            document.getElementById('azureProject').value = settings.azure.project || '';
            document.getElementById('azureRepo').value = settings.azure.repository || '';
            document.getElementById('azurePat').value = settings.azure.pat || '';
        }
        
        // Set common settings
        document.getElementById('defaultBranch').value = settings.branch || 'main';
        document.getElementById('teamMembers').value = Array.isArray(settings.teamMembers) 
            ? settings.teamMembers.join(', ') 
            : '';
            
        updateProviderSettings();
    }

    // Save settings
    async function saveSettings(e) {
        e.preventDefault();
        
        const provider = document.querySelector('input[name="gitProvider"]:checked').value;
        const settings = {
            gitProvider: provider,
            github: {
                username: document.getElementById('githubUsername').value.trim(),
                token: document.getElementById('githubToken').value.trim(),
                repository: document.getElementById('githubRepo').value.trim()
            },
            azure: {
                organization: document.getElementById('azureOrg').value.trim(),
                project: document.getElementById('azureProject').value.trim(),
                repository: document.getElementById('azureRepo').value.trim(),
                pat: document.getElementById('azurePat').value.trim()
            },
            branch: document.getElementById('defaultBranch').value.trim() || 'main',
            teamMembers: document.getElementById('teamMembers').value
                .split(',')
                .map(email => email.trim())
                .filter(Boolean)
        };
        
        try {
            await window.gitSettings.saveSettings(settings);
            showNotification('Settings saved successfully!', 'success');
            closeModal();
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Failed to save settings: ' + error.message, 'error');
        }
    }

    // Test connection
    async function testConnection() {
        const provider = document.querySelector('input[name="gitProvider"]:checked').value;
        const settings = {
            gitProvider: provider,
            github: {
                username: document.getElementById('githubUsername').value.trim(),
                token: document.getElementById('githubToken').value.trim(),
                repository: document.getElementById('githubRepo').value.trim()
            },
            azure: {
                organization: document.getElementById('azureOrg').value.trim(),
                project: document.getElementById('azureProject').value.trim(),
                repository: document.getElementById('azureRepo').value.trim(),
                pat: document.getElementById('azurePat').value.trim()
            }
        };
        
        try {
            // Show loading state
            testConnectionBtn.disabled = true;
            testConnectionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
            
            if (provider === 'github') {
                await testGitHubConnection(settings.github);
            } else {
                await testAzureConnection(settings.azure);
            }
            
            showNotification('Connection successful!', 'success');
        } catch (error) {
            console.error('Connection test failed:', error);
            showNotification('Connection failed: ' + error.message, 'error');
        } finally {
            testConnectionBtn.disabled = false;
            testConnectionBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
        }
    }
    
    async function testGitHubConnection(settings) {
        if (!settings.username || !settings.token || !settings.repository) {
            throw new Error('Please fill in all required fields');
        }
        
        const url = `https://api.github.com/repos/${settings.username}/${settings.repository}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${settings.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to connect to GitHub');
        }
    }
    
    async function testAzureConnection(settings) {
        if (!settings.organization || !settings.project || !settings.repository || !settings.pat) {
            throw new Error('Please fill in all required fields');
        }
        
        const url = `https://dev.azure.com/${settings.organization}/${settings.project}/_apis/git/repositories/${settings.repository}?api-version=7.0`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${btoa(':' + settings.pat)}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to connect to Azure DevOps');
        }
    }

    // Modal functions
    function openModal() {
        modal.style.display = 'block';
        loadSettings();
    }
    
    function closeModal() {
        modal.style.display = 'none';
    }

    // Event listeners
    providerRadios.forEach(radio => {
        radio.addEventListener('change', updateProviderSettings);
    });
    
    closeBtn.addEventListener('click', closeModal);
    form.addEventListener('submit', saveSettings);
    testConnectionBtn.addEventListener('click', testConnection);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Make openModal function globally available
    window.openGitSettings = openModal;
});

// Helper function to show notifications
function showNotification(message, type = 'info') {
    // You can replace this with your preferred notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 4px;
        color: white;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }
    
    .notification.success {
        background-color: #38a169;
    }
    
    .notification.error {
        background-color: #e53e3e;
    }
    
    .notification.info {
        background-color: #3182ce;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);
