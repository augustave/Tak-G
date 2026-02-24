import { store } from './Store.js';

export class OpsLog {
    constructor() {
        this.feedEl = document.getElementById('ops-log-feed');
        
        document.getElementById('btn-export-log')?.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.get('opsLog'), null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "TAK_OPS_LOG_" + new Date().toISOString() + ".json");
            dlAnchorElem.click();
            this.addEntry('MODE', 'SYSTEM', 'OPS LOG EXPORTED');
        });

        document.getElementById('btn-clear-log')?.addEventListener('click', () => {
            store.set('opsLog', []);
            // This relies on a global clearUndoWindow which should be in DOMController
            // We dispatch an event or trigger it safely.
            if(window.clearUndoWindow) window.clearUndoWindow();
            if(this.feedEl) this.feedEl.replaceChildren();
            this.addEntry('MODE', 'SYSTEM', 'SESSION CLEARED');
        });

        this.addEntry('MODE', 'SYSTEM', 'SESSION INITIALIZED');
    }

    appendSpan(parent, className, text) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        parent.appendChild(span);
    }

    addEntry(action, target, details, severity = 0, timeToEvent = 999) {
        const now = new Date();
        const ts = now.toISOString().substr(11, 8) + 'Z';
        // Severity scale: 0 = Info, 1 = Warn, 2 = Critical
        const entryObj = { ts, action, target, details, severity, timeToEvent };
        
        let logs = [...store.get('opsLog')];
        logs.push(entryObj);
        
        // PRD Requirement: Alert Queue Priority Rules
        // 1. HIGH threat first (highest severity)
        // 2. Shortest time_to_event next
        // 3. Most recent timestamp fallback
        logs.sort((a, b) => {
            if (b.severity !== a.severity) return b.severity - a.severity;
            if (a.timeToEvent !== b.timeToEvent) return a.timeToEvent - b.timeToEvent;
            return b.ts.localeCompare(a.ts);
        });
        
        // Cap history to 50 for performance
        if (logs.length > 50) logs = logs.slice(0, 50);
        store.set('opsLog', logs);
        
        this.renderFeed();
        return true;
    }

    renderFeed() {
        if (!this.feedEl) return;
        this.feedEl.replaceChildren();
        
        const logs = store.get('opsLog');
        logs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = 'sigint-entry';
            
            // Map styling
            let colorClass = 'info';
            if (log.severity === 1) colorClass = 'warn';
            if (log.severity === 2) colorClass = 'crit sigint-flash'; // Add flashing class for HIGH threats
            
            if (log.action === 'DESIGNATE') colorClass += ' crit';
            
            this.appendSpan(entry, 'sigint-time', log.ts);
            this.appendSpan(entry, `sigint-tag ${colorClass}`, log.action);
            this.appendSpan(entry, 'sigint-text', `[${log.target}] ${log.details}`);
            
            this.feedEl.appendChild(entry);
        });
    }
}
