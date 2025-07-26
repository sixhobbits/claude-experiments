// Onboarding Module
(function() {
    // Configuration
    const ONBOARDING_STEPS = [
        {
            selector: '[data-onboarding-step="1"]',
            title: 'Real-time Metrics',
            text: 'Monitor your system\'s CPU, memory, disk usage, and uptime in real-time. These cards update automatically every few seconds.',
            position: 'bottom'
        },
        {
            selector: '[data-onboarding-step="2"]',
            title: 'Export Your Data',
            text: 'Download your monitoring data as CSV for analysis or PDF for reports. Perfect for keeping records or sharing with your team.',
            position: 'top'
        },
        {
            selector: '[data-onboarding-step="3"]',
            title: 'Configure Alerts',
            text: 'Set custom thresholds for CPU, memory, and disk usage. Get notified via email when your system needs attention.',
            position: 'top'
        },
        {
            selector: '[data-onboarding-step="4"]',
            title: 'API Access',
            text: 'Generate API keys to integrate MicroMonitor with your scripts and applications. Full programmatic access to all your monitoring data.',
            position: 'top'
        }
    ];

    let currentStep = 0;
    let overlay = null;
    let tooltip = null;

    // Initialize onboarding for demo users
    function initOnboarding() {
        const currentUser = localStorage.getItem('username');
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        const hasCompletedTour = localStorage.getItem('hasCompletedTour');

        // Only show for demo users who haven't seen it
        if (currentUser === 'demo' && !hasSeenWelcome) {
            setTimeout(() => {
                showWelcomeMessage();
            }, 1000);
        }
    }

    // Show welcome message
    function showWelcomeMessage() {
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
            localStorage.setItem('hasSeenWelcome', 'true');
        }
    }

    // Dismiss welcome message
    window.dismissWelcome = function() {
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.opacity = '0';
            setTimeout(() => {
                welcomeMessage.style.display = 'none';
            }, 300);
        }
    };

    // Start onboarding tour
    window.startOnboarding = function() {
        dismissWelcome();
        currentStep = 0;
        createOverlay();
        createTooltip();
        showStep(currentStep);
        
        // Track tour started
        if (typeof fetch !== 'undefined') {
            fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    event: 'onboarding_tour_started'
                })
            }).catch(() => {});
        }
    };

    // Create overlay
    function createOverlay() {
        overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.addEventListener('click', skipTour);
        document.body.appendChild(overlay);
        
        // Trigger show animation
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);
    }

    // Create tooltip
    function createTooltip() {
        tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        
        const content = `
            <h4 id="tooltip-title"></h4>
            <p id="tooltip-text"></p>
            <div class="onboarding-progress" id="progress-indicator"></div>
            <div class="onboarding-tooltip-actions">
                <button class="onboarding-btn onboarding-skip" onclick="skipTour()">Skip Tour</button>
                <button class="onboarding-btn onboarding-next" id="next-btn" onclick="nextStep()">Next</button>
            </div>
        `;
        
        tooltip.innerHTML = content;
        document.body.appendChild(tooltip);
    }

    // Show specific step
    function showStep(stepIndex) {
        if (stepIndex >= ONBOARDING_STEPS.length) {
            completeTour();
            return;
        }

        const step = ONBOARDING_STEPS[stepIndex];
        const element = document.querySelector(step.selector);
        
        if (!element) {
            nextStep();
            return;
        }

        // Remove previous highlights
        document.querySelectorAll('.onboarding-highlight').forEach(el => {
            el.classList.remove('onboarding-highlight');
        });

        // Highlight current element
        element.classList.add('onboarding-highlight');
        
        // Update tooltip content
        document.getElementById('tooltip-title').textContent = step.title;
        document.getElementById('tooltip-text').textContent = step.text;
        
        // Update progress indicator
        updateProgress();
        
        // Update button text
        const nextBtn = document.getElementById('next-btn');
        if (stepIndex === ONBOARDING_STEPS.length - 1) {
            nextBtn.textContent = 'Finish';
        } else {
            nextBtn.textContent = 'Next';
        }
        
        // Position tooltip
        positionTooltip(element, step.position);
        
        // Show tooltip
        tooltip.classList.add('show');
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Position tooltip relative to element
    function positionTooltip(element, preferredPosition) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let top, left;
        
        switch (preferredPosition) {
            case 'top':
                top = rect.top - tooltipRect.height - 20;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
            default:
                top = rect.bottom + 20;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
        }
        
        // Ensure tooltip stays within viewport
        const padding = 20;
        if (left < padding) left = padding;
        if (left + tooltipRect.width > window.innerWidth - padding) {
            left = window.innerWidth - tooltipRect.width - padding;
        }
        if (top < padding) top = rect.bottom + 20;
        if (top + tooltipRect.height > window.innerHeight - padding) {
            top = rect.top - tooltipRect.height - 20;
        }
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    // Update progress indicator
    function updateProgress() {
        const progressContainer = document.getElementById('progress-indicator');
        progressContainer.innerHTML = '';
        
        for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            if (i === currentStep) {
                dot.classList.add('active');
            }
            progressContainer.appendChild(dot);
        }
    }

    // Next step
    window.nextStep = function() {
        currentStep++;
        if (currentStep < ONBOARDING_STEPS.length) {
            showStep(currentStep);
        } else {
            completeTour();
        }
    };

    // Skip tour
    window.skipTour = function() {
        cleanup();
        
        // Track tour skipped
        if (typeof fetch !== 'undefined') {
            fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    event: 'onboarding_tour_skipped',
                    data: { completed_steps: currentStep }
                })
            }).catch(() => {});
        }
    };

    // Complete tour
    function completeTour() {
        cleanup();
        localStorage.setItem('hasCompletedTour', 'true');
        
        // Show a completion message
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            animation: slideDown 0.5s ease-out;
        `;
        message.textContent = 'Great! You\'re all set to start monitoring. 🎉';
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 300);
        }, 3000);
        
        // Track tour completed
        if (typeof fetch !== 'undefined') {
            fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    event: 'onboarding_tour_completed'
                })
            }).catch(() => {});
        }
    }

    // Cleanup
    function cleanup() {
        // Remove highlights
        document.querySelectorAll('.onboarding-highlight').forEach(el => {
            el.classList.remove('onboarding-highlight');
        });
        
        // Remove overlay
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
        
        // Remove tooltip
        if (tooltip) {
            tooltip.classList.remove('show');
            setTimeout(() => {
                if (tooltip && tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 300);
        }
    }

    // Add keyboard support
    document.addEventListener('keydown', function(e) {
        if (!tooltip || !tooltip.classList.contains('show')) return;
        
        if (e.key === 'Escape') {
            skipTour();
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            nextStep();
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOnboarding);
    } else {
        initOnboarding();
    }
})();