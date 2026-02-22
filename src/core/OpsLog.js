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

    addEntry(action, target, details) {
        const now = new Date();
        const ts = now.toISOString().substr(11, 8) + 'Z';
        const entryObj = { ts, action, target, details };
        
        const logs = [...store.get('opsLog')];
        logs.unshift(entryObj);
        store.set('opsLog', logs);
        
        let insertedEntry = null;
        
        if (this.feedEl) {
            const entry = document.createElement('div');
            entry.className = 'sigint-entry';
            const colorClass = action === 'DESIGNATE' ? 'crit' : (action === 'SELECT' ? 'info' : 'warn');
            this.appendSpan(entry, 'sigint-time', ts);
            this.appendSpan(entry, `sigint-tag ${colorClass}`, action);
            this.appendSpan(entry, 'sigint-text', `[${target}] ${details}`);
            
            this.feedEl.insertBefore(entry, this.feedEl.firstChild);
            insertedEntry = entry;
            
            while(this.feedEl.children.length > 30) {
                this.feedEl.removeChild(this.feedEl.lastChild);
            }
        }
        return insertedEntry;
    }
}
