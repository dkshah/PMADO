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
        
        // Parse team members - handle both array of strings and array of objects
        let teamMembersStr = '';
        if (Array.isArray(settings.teamMembers)) {
            if (settings.teamMembers.length > 0) {
                // Check if it's an array of objects with name/email or just strings
                if (typeof settings.teamMembers[0] === 'object') {
                    teamMembersStr = settings.teamMembers.map(m => m.email).join(', ');
                } else {
                    teamMembersStr = settings.teamMembers.join(', ');
                }
            }
        }
        document.getElementById('teamMembers').value = teamMembersStr;
            
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
            if (!window.gitSettings) {
                throw new Error('Git settings service not initialized');
            }
            window.gitSettings.saveSettings(settings);
            if (window.Toast) {
                window.Toast.success('Settings saved successfully!');
            }
            closeModal();
        } catch (error) {
            console.error('Error saving settings:', error);
            if (window.Toast) {
                window.Toast.error('Failed to save settings: ' + error.message);
            }
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
            
            let result;
            if (provider === 'github') {
                result = await testGitHubConnection(settings.github);
            } else {
                result = await testAzureConnection(settings.azure);
            }
            
            if (window.Toast) {
                if (result.success) {
                    window.Toast.success(result.message);
                } else {
                    window.Toast.error(result.message);
                }
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            if (window.Toast) {
                window.Toast.error('Connection failed: ' + error.message);
            }
        } finally {
            testConnectionBtn.disabled = false;
            testConnectionBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
        }
    }
    
    async function testGitHubConnection(settings) {
        const { username, token, repository } = settings;
        // Use the proxy server for GitHub API calls
        const url = `/api/github/repos/${username}/${repository}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                return { success: true, message: 'Successfully connected to GitHub repository' };
            } else {
                const error = await response.json();
                return { 
                    success: false, 
                    message: error.message || 'Failed to connect to GitHub. Please check your credentials.'
                };
            }
        } catch (error) {
            console.error('GitHub connection error:', error);
            return { 
                success: false, 
                message: `Connection error: ${error.message}. Make sure the server is running.` 
            };
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

