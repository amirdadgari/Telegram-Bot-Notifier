class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'system';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
        this.updateToggleButton();
    }

    getStoredTheme() {
        return localStorage.getItem('theme');
    }

    setStoredTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    applyTheme(theme) {
        // Apply theme using multiple methods to ensure it works
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.dataset.theme = theme;
        
        // Fallback: add class to html and body elements
        document.documentElement.className = theme + '-theme';
        document.body.className = theme + '-theme';
        
        this.currentTheme = theme;
        this.setStoredTheme(theme);
        
        // Force CSS refresh
        document.body.style.display = 'none';
        document.body.offsetHeight; // Trigger reflow
        document.body.style.display = '';
    }

    setupEventListeners() {
        // Toggle theme dropdown
        const toggleBtn = document.getElementById('theme-toggle-btn');
        const dropdown = document.getElementById('theme-dropdown');
        
        if (toggleBtn && dropdown) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close admin dropdown if open
                const adminDropdown = document.getElementById('admin-dropdown');
                if (adminDropdown) adminDropdown.classList.remove('show');
                
                dropdown.classList.toggle('show');
            });

            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Toggle admin dropdown
        const adminToggleBtn = document.getElementById('admin-dropdown-btn');
        const adminDropdown = document.getElementById('admin-dropdown');
        
        if (adminToggleBtn && adminDropdown) {
            adminToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close theme dropdown if open
                if (dropdown) dropdown.classList.remove('show');
                
                adminDropdown.classList.toggle('show');
            });

            adminDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Close all dropdowns when clicking outside
        document.addEventListener('click', () => {
            if (dropdown) dropdown.classList.remove('show');
            if (adminDropdown) adminDropdown.classList.remove('show');
        });
        
        // Setup modal functionality
        this.setupModalHandlers();

        // Theme options
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.getAttribute('data-theme-value');
                this.applyTheme(theme);
                this.updateToggleButton();
                document.getElementById('theme-dropdown').classList.remove('show');
            });
        });

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (this.currentTheme === 'system') {
                    this.updateToggleButton();
                }
            });
        }
    }

    updateToggleButton() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        const toggleIcon = document.getElementById('theme-icon');
        const toggleText = document.getElementById('theme-text');
        
        if (!toggleBtn || !toggleIcon || !toggleText) return;

        // Update active state in dropdown
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.getAttribute('data-theme-value') === this.currentTheme) {
                option.classList.add('active');
            }
        });

        // Update button appearance based on current theme
        let icon, text;
        
        if (this.currentTheme === 'system') {
            const systemIsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            icon = systemIsDark ? '🌙' : '☀️';
            text = 'System';
        } else if (this.currentTheme === 'dark') {
            icon = '🌙';
            text = 'Dark';
        } else {
            icon = '☀️';
            text = 'Light';
        }

        toggleIcon.textContent = icon;
        toggleText.textContent = text;
    }

    getThemeIcon(theme) {
        switch (theme) {
            case 'light':
                return '☀️';
            case 'dark':
                return '🌙';
            case 'system':
                return '🖥️';
            default:
                return '🖥️';
        }
    }

    getThemeText(theme) {
        switch (theme) {
            case 'light':
                return 'Light';
            case 'dark':
                return 'Dark';
            case 'system':
                return 'System';
            default:
                return 'System';
        }
    }
    
    setupModalHandlers() {
        // Modal open/close functionality
        const modals = document.querySelectorAll('.modal');
        const modalTriggers = document.querySelectorAll('[data-modal]');
        const modalCloses = document.querySelectorAll('.modal-close, .modal-cancel');
        
        // Open modals
        modalTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const modalId = trigger.getAttribute('data-modal');
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                }
            });
        });
        
        // Close modals
        modalCloses.forEach(close => {
            close.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = close.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                    document.body.style.overflow = '';
                }
            });
        });
        
        // Close modal when clicking outside
        modals.forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    document.body.style.overflow = '';
                }
            });
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modals.forEach(modal => {
                    if (modal.classList.contains('show')) {
                        modal.classList.remove('show');
                        document.body.style.overflow = '';
                    }
                });
            }
        });
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});
