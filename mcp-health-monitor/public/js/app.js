document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('agentGrid');
    const globalStatus = document.getElementById('globalStatus');
    const globalStatusText = globalStatus.querySelector('.status-text');
    const refreshBtn = document.getElementById('refreshBtn');
    const lastScanTime = document.getElementById('lastScanTime');

    function createCard(agent) {
        const card = document.createElement('div');
        card.className = `agent-card ${agent.online ? 'online' : 'offline'}`;
        card.id = `card-${agent.id}`;
        
        card.innerHTML = `
            <div class="card-header">
                <h3>${agent.name}</h3>
                <span class="status-badge">${agent.online ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
            <div class="card-body">
                <p>Endpoint <span class="metric-value">:${agent.extPort}${agent.path}</span></p>
                <p>Latency <span class="metric-value">${agent.latencyMs ? agent.latencyMs + 'ms' : '--'}</span></p>
                ${agent.telemetry ? `
                <p>Proc State <span class="metric-value">${agent.telemetry.child_process_state}</span></p>
                <p>RAM <span class="metric-value">${agent.telemetry.ram_usage_mb} MB</span></p>
                ` : ''}
                <div class="error-msg">${agent.error || 'Connection Failed'}</div>
            </div>
        `;
        return card;
    }

    function updateDashboard(data) {
        if (!data || !data.agents) return;
        
        grid.innerHTML = '';
        let onlineCount = 0;

        data.agents.forEach(agent => {
            if (agent.online) onlineCount++;
            grid.appendChild(createCard(agent));
        });

        // Update overall status
        globalStatus.classList.remove('online', 'offline');
        if (onlineCount === data.agents.length) {
            globalStatus.classList.add('online');
            globalStatusText.textContent = 'All Systems Operational';
        } else if (onlineCount > 0) {
            globalStatus.classList.add('offline'); // Partial degradation is still offline/red warning
            globalStatusText.textContent = `${onlineCount}/${data.agents.length} Systems Online`;
        } else {
            globalStatus.classList.add('offline');
            globalStatusText.textContent = 'Swarm Offline';
        }

        // Update time
        const date = new Date(data.timestamp);
        lastScanTime.textContent = date.toLocaleTimeString();
    }

    async function fetchStatus() {
        refreshBtn.classList.add('spinning');
        refreshBtn.textContent = 'Scanning...';
        
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            updateDashboard(data);
        } catch (err) {
            console.error("Failed to fetch health data", err);
            globalStatus.classList.remove('online');
            globalStatus.classList.add('offline');
            globalStatusText.textContent = 'Monitor API Unreachable';
        } finally {
            setTimeout(() => {
                refreshBtn.classList.remove('spinning');
                refreshBtn.textContent = 'Force Refresh';
            }, 500);
        }
    }

    refreshBtn.addEventListener('click', fetchStatus);

    // Auto refresh every 60 seconds on the frontend
    setInterval(fetchStatus, 60000);
    fetchStatus();
});
