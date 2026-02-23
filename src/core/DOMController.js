import { store } from './Store.js';

export class DOMController {
    constructor(trackManager, opsLog) {
        this.trackManager = trackManager;
        this.opsLog = opsLog;

        this.confirmStrip = document.getElementById('confirm-strip');
        this.confirmTitle = document.getElementById('confirm-title');
        this.confirmTarget = document.getElementById('confirm-target');
        this.confirmHint = document.getElementById('confirm-hint');
        this.reasonSelect = document.getElementById('confirm-reason');
        this.confirmButton = document.getElementById('btn-confirm');
        this.cancelButton = document.getElementById('btn-cancel');
        
        this.undoStrip = document.getElementById('undo-strip');
        this.undoText = document.getElementById('undo-text');
        this.undoButton = document.getElementById('btn-undo');
        
        this.activeTrackPanelEl = document.getElementById('active-track-panel');
        this.atLockStatusEl = document.getElementById('at-lock-status');
        this.atDestinationEl = document.getElementById('at-destination');
        this.setDestinationButtonEl = document.getElementById('btn-set-destination');
        this.clearDestinationButtonEl = document.getElementById('btn-clear-destination');
        
        this.tbody = document.getElementById('track-tbody');
        this.cursorCoords = document.getElementById('cursor-coords');
        this.cursorMgrs = document.getElementById('cursor-mgrs');

        this.undoTimeoutId = null;
        this.destinationMode = false;

        // Make clearUndoWindow globally available for OpsLog clear
        window.clearUndoWindow = () => this.clearUndoWindow();

        this.initDOMListeners();
        this.updateTrackTable();

        setInterval(() => {
            const selectedId = store.get('selectedTrackId');
            if(selectedId && !document.hidden) {
                const track = this.trackManager.getTrackData().find(t => t.id === selectedId);
                if(track) this.updateActiveTrackPanel(track);
            }
        }, 1000);
    }

    initDOMListeners() {
        this.setDestinationButtonEl?.addEventListener('click', () => {
            const selectedId = store.get('selectedTrackId');
            if(!selectedId) {
                this.opsLog.addEntry('MODE', 'SYSTEM', 'DEST MODE REQUIRES TRACK SELECT');
                return;
            }
            this.destinationMode = !this.destinationMode;
            this.setDestinationButtonEl.classList.toggle('active', this.destinationMode);
            this.setDestinationButtonEl.textContent = this.destinationMode ? 'CLICK MAP...' : 'SET DEST';
        });

        this.clearDestinationButtonEl?.addEventListener('click', () => {
            const selectedId = store.get('selectedTrackId');
            if(!selectedId) return;
            if(this.trackManager.clearDestination(selectedId)) {
                this.opsLog.addEntry('DESTINATION', selectedId, 'CLEARED');
                this.updateTrackTable();
                
                const track = this.trackManager.getTrackData().find(t => t.id === selectedId);
                if(track) this.updateActiveTrackPanel(track);
                store.set('selectedTrackId', selectedId); // Force re-render of visuals
            }
            this.destinationMode = false;
            this.setDestinationButtonEl.classList.remove('active');
            this.setDestinationButtonEl.textContent = 'SET DEST';
        });

        this.confirmButton?.addEventListener('click', () => {
            if(!store.get('pendingDesignation')) return;
            if(store.get('pendingDesignationStage') === 1) {
                this.setDesignationStage(2);
                return;
            }
            this.commitDesignation();
        });

        this.cancelButton?.addEventListener('click', () => {
            store.set('pendingDesignation', null);
            this.hideConfirmStrip();
        });

        this.undoButton?.addEventListener('click', () => this.undoLastDesignation());

        const btnMap = document.getElementById('btn-map');
        if(btnMap) {
            btnMap.addEventListener('click', () => {
                const isTopo = store.get('mapMode') === 1;
                store.set('mapMode', isTopo ? 0 : 1);
                btnMap.textContent = isTopo ? 'MAP: FLAT' : 'MAP: TOPO';
                btnMap.classList.toggle('active', !isTopo);
            });
        }

        document.addEventListener('mousemove', e => {
            if(!this.cursorCoords || !this.cursorMgrs) return;
            const mx = ((e.clientX / window.innerWidth) * 2 - 1) * 40;
            const my = (-(e.clientY / window.innerHeight) * 2 + 1) * 40;
            this.cursorCoords.textContent = `${mx.toFixed(2).padStart(7, ' ')} / ${my.toFixed(2).padStart(7, ' ')}`;
            const mgrsE = Math.floor(48250 + mx * 50);
            const mgrsN = Math.floor(17530 + my * 50);
            this.cursorMgrs.textContent = `38TLN ${String(mgrsE).padStart(5,'0')} ${String(mgrsN).padStart(5,'0')}`;
        });
    }

    selectTrack(id) {
        if(store.get('selectedTrackId') === id) return;
        store.set('selectedTrackId', id);
        
        const track = this.trackManager.getTrackData().find(t => t.id === id);
        if(track) {
            const prov = this.trackManager.getProvenance(id);
            this.opsLog.addEntry('SELECT', id, `TYPE:${track.subtype} SRC:${prov.source}`);
            this.updateActiveTrackPanel(track);
        } else {
            this.updateActiveTrackPanel(null);
        }
        
        this.trackManager.updateSelectionVisuals(id);
        this.updateTrackTable();
    }

    updateActiveTrackPanel(track) {
        if(!this.activeTrackPanelEl) return;
        if(!track) {
            this.activeTrackPanelEl.style.display = 'none';
            this.activeTrackPanelEl.classList.remove('track-locked');
            this.atLockStatusEl.textContent = 'STANDBY';
            this.atDestinationEl.textContent = '--';
            this.setDestinationButtonEl.disabled = true;
            this.clearDestinationButtonEl.disabled = true;
            this.destinationMode = false;
            this.setDestinationButtonEl.classList.remove('active');
            this.setDestinationButtonEl.textContent = 'SET DEST';
            return;
        }

        this.activeTrackPanelEl.style.display = 'block';
        this.activeTrackPanelEl.classList.add('track-locked');
        this.setDestinationButtonEl.disabled = false;
        this.clearDestinationButtonEl.disabled = false;
        
        const prov = this.trackManager.getProvenance(track.id);
        document.getElementById('at-id').textContent = track.id + ' / ' + track.subtype;
        
        const brg = (Math.atan2(track.x, track.y) * 180 / Math.PI + 360) % 360;
        const rng = Math.sqrt(track.x * track.x + track.y * track.y).toFixed(1);
        document.getElementById('at-kinematics').textContent = `${brg.toFixed(0).padStart(3,'0')}° / ${rng}km / ${track.spd}kt`;
        document.getElementById('at-source').textContent = prov.source;
        
        const confEl = document.getElementById('at-confidence');
        confEl.textContent = prov.confidence;
        confEl.className = 'data-value ' + (prov.confidence === 'HIGH' ? 'green' : (prov.confidence === 'MEDIUM' ? 'amber' : 'red'));
        
        const ageSeconds = Math.floor((Date.now() - prov.lastUpdate) / 1000);
        const ageEl = document.getElementById('at-age');
        ageEl.textContent = ageSeconds + 's';
        
        const badgeEl = document.getElementById('at-provenance-badge');
        if(ageSeconds > 120) {
            ageEl.textContent += ' [STALE]';
            ageEl.className = 'data-value red';
            badgeEl.textContent = 'STALE';
            badgeEl.className = 'panel-badge badge-alert';
            this.atLockStatusEl.textContent = 'LOCK / STALE';
            this.atLockStatusEl.className = 'data-value amber';
        } else {
            ageEl.className = 'data-value';
            badgeEl.textContent = 'TRACKING';
            badgeEl.className = 'panel-badge badge-nominal';
            this.atLockStatusEl.textContent = 'LOCKED ON';
            this.atLockStatusEl.className = 'data-value cyan';
        }

        const dest = this.trackManager.getDestination(track.id);
        this.atDestinationEl.textContent = dest ? dest.mgrs : '--';
    }

    updateTrackTable() {
        if(!this.tbody) return;
        this.tbody.replaceChildren();
        
        const selectedTrackId = store.get('selectedTrackId');
        
        this.trackManager.getTrackData().forEach(t => {
            const iconClass = t.type === 'hostile' ? 'hostile' : t.type === 'friendly' ? 'friendly' : 'unknown';
            const color = t.type === 'hostile' ? 'var(--red-force)' : t.type === 'friendly' ? 'var(--blue-force)' : 'var(--yellow-unknown)';
            const brg = (Math.atan2(t.x, t.y) * 180 / Math.PI + 360) % 360;
            const rng = Math.sqrt(t.x * t.x + t.y * t.y).toFixed(1);
            
            const prov = this.trackManager.getProvenance(t.id);
            const ageSeconds = Math.floor((Date.now() - prov.lastUpdate) / 1000);
            const confClass = prov.confidence === 'HIGH' ? 'trust-high' : (prov.confidence === 'MEDIUM' ? 'trust-medium' : 'trust-low');
            
            const row = document.createElement('tr');
            const isSelected = t.id === selectedTrackId;
            row.className = isSelected ? 'track-selected' : '';
            row.style.cursor = 'pointer';
            row.tabIndex = 0;
            
            row.onclick = () => {
                this.selectTrack(t.id);
                document.body.classList.remove('left-drawer-open');
                document.body.classList.remove('right-drawer-open');
            };
            row.onkeydown = (e) => {
                if(e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectTrack(t.id);
                }
            };

            const idCell = document.createElement('td');
            idCell.style.color = color;
            const icon = document.createElement('span');
            icon.className = `track-icon ${iconClass}`;
            idCell.appendChild(icon);
            idCell.appendChild(document.createTextNode(t.id));
            if(isSelected) {
                const pin = document.createElement('span');
                pin.className = 'track-lock-pin';
                pin.textContent = 'LOCK';
                idCell.appendChild(pin);
            }

            const subtypeCell = document.createElement('td');
            subtypeCell.textContent = t.subtype;
            const bearingCell = document.createElement('td');
            bearingCell.textContent = `${brg.toFixed(0).padStart(3,'0')}°`;
            const rangeCell = document.createElement('td');
            rangeCell.textContent = `${rng}km`;
            const speedCell = document.createElement('td');
            speedCell.textContent = String(t.spd);

            const trustCell = document.createElement('td');
            const trustWrap = document.createElement('span');
            trustWrap.className = 'track-trust-wrap';
            const confBadge = document.createElement('span');
            confBadge.className = `track-trust-badge ${confClass}`;
            confBadge.textContent = prov.confidence;
            const ageBadge = document.createElement('span');
            ageBadge.className = `track-age-badge ${ageSeconds > 120 ? 'stale' : ''}`;
            ageBadge.textContent = `${ageSeconds}s`;
            trustWrap.appendChild(confBadge);
            trustWrap.appendChild(ageBadge);
            trustCell.appendChild(trustWrap);

            row.appendChild(idCell);
            row.appendChild(subtypeCell);
            row.appendChild(bearingCell);
            row.appendChild(rangeCell);
            row.appendChild(speedCell);
            row.appendChild(trustCell);
            this.tbody.appendChild(row);
        });
    }

    setDesignationStage(stage) {
        store.set('pendingDesignationStage', stage);
        if(!store.get('pendingDesignation')) return;
        
        if (stage === 1) {
            this.confirmTitle.textContent = 'REVIEW DESIGNATION';
            this.confirmHint.textContent = 'R OR ENTER TO ARM';
            this.confirmButton.textContent = 'REVIEW [R]';
            this.confirmStrip.style.borderColor = 'var(--amber-alert)';
        } else {
            this.confirmTitle.textContent = 'FINAL CONFIRMATION';
            this.confirmHint.textContent = 'ENTER TO COMMIT';
            this.confirmButton.textContent = 'COMMIT [ENTER]';
            this.confirmStrip.style.borderColor = 'var(--red-force)';
        }
    }

    hideConfirmStrip() {
        if(this.confirmStrip) {
            this.confirmStrip.style.display = 'none';
            this.confirmStrip.style.borderColor = 'var(--amber-alert)';
        }
        store.set('pendingDesignationStage', 0);
    }

    clearUndoWindow() {
        if (this.undoTimeoutId) {
            clearTimeout(this.undoTimeoutId);
            this.undoTimeoutId = null;
        }
        store.set('undoDesignation', null);
        if(this.undoStrip) this.undoStrip.style.display = 'none';
    }

    commitDesignation() {
        const pending = store.get('pendingDesignation');
        if(!pending) return;
        
        const reason = this.reasonSelect.style.display !== 'none' ? this.reasonSelect.value : 'N/A';
        const details = `AT ${pending.mgrs} ${reason !== 'N/A' ? 'R:'+reason : ''}`.trim();
        const entryNode = this.opsLog.addEntry('DESIGNATE', pending.trackId, details);

        this.clearUndoWindow();
        store.set('undoDesignation', { trackId: pending.trackId, details, entryNode });
        
        this.undoText.textContent = `DESIGNATED ${pending.trackId} @ ${pending.mgrs}`;
        this.undoStrip.style.display = 'flex';
        this.undoTimeoutId = setTimeout(() => this.clearUndoWindow(), 8000);

        store.set('pendingDesignation', null);
        this.hideConfirmStrip();
    }

    undoLastDesignation() {
        const undoDesig = store.get('undoDesignation');
        if(!undoDesig) return;
        
        const logs = [...store.get('opsLog')];
        const idx = logs.findIndex(item => item.action === 'DESIGNATE' && item.target === undoDesig.trackId && item.details === undoDesig.details);
        if(idx !== -1) {
            logs.splice(idx, 1);
            store.set('opsLog', logs);
        }
        
        if(undoDesig.entryNode && undoDesig.entryNode.parentElement) {
            undoDesig.entryNode.parentElement.removeChild(undoDesig.entryNode);
        }
        
        this.opsLog.addEntry('MODE', 'SYSTEM', `DESIGNATION REVOKED ${undoDesig.trackId}`);
        this.clearUndoWindow();
    }
}
