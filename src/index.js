import React from 'react';
import { createRoot } from 'react-dom/client';
import AIEnabledBiddingSystem from './components/AIEnabledBiddingSystem';
import AIEnabledBiddingDashboard from './components/AIEnabledBiddingDashboard';

document.addEventListener('DOMContentLoaded', function() {
    const formContainer = document.getElementById('ai-enabled-bidding-system');
    if (formContainer) {
        const root = createRoot(formContainer);
        root.render(<AIEnabledBiddingSystem />);
    }

    const dashboardContainer = document.getElementById('ai-enabled-bidding-dashboard');
    if (dashboardContainer) {
        const root = createRoot(dashboardContainer);
        root.render(<AIEnabledBiddingDashboard />);
    }
});