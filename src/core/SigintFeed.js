import { sigintMessages } from '../data/mockData.js';
import { store } from './Store.js';

export class SigintFeed {
    constructor() {
        this.feedEl = document.getElementById('sigint-feed');
        this.sigintFiltersEl = document.getElementById('sigint-filters');
        this.sigintStatusBadgeEl = document.getElementById('sigint-status-badge');
        
        this.sigIdx = 0;
        this.timerId = null;
        this.activeFilter = 'all';

        this.initDOMListeners();
        this.addSigintEntry();
        this.scheduleSigintTick();

        // Subscribe to pause state
        store.subscribe('sigintPaused', (paused) => {
            if(paused) {
                this.sigintStatusBadgeEl.textContent = 'II PAUSED';
                this.sigintStatusBadgeEl.className = 'panel-badge badge-alert';
                this.feedEl.classList.add('paused');
            } else {
                this.sigintStatusBadgeEl.textContent = '● STREAMING';
                this.sigintStatusBadgeEl.className = 'panel-badge badge-live';
                this.feedEl.classList.remove('paused');
            }
        });
    }

    initDOMListeners() {
        if(!this.feedEl || !this.sigintFiltersEl) return;

        this.sigintFiltersEl.addEventListener('click', e => {
            const chip = e.target.closest('.sigint-filter-chip');
            if(!chip) return;
            this.activeFilter = chip.dataset.filter || 'all';
            this.sigintFiltersEl.querySelectorAll('.sigint-filter-chip').forEach(btn => {
                btn.classList.toggle('active', btn === chip);
            });
            this.applyFilter();
        });

        this.feedEl.addEventListener('mouseenter', () => store.set('sigintPaused', true));
        this.feedEl.addEventListener('mouseleave', () => store.set('sigintPaused', false));
    }

    appendSpan(parent, className, text) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        parent.appendChild(span);
    }

    applyFilter() {
        if(!this.feedEl) return;
        const entries = Array.from(this.feedEl.children);
        let shown = 0;
        entries.forEach(entry => {
            const matches = this.activeFilter === 'all' || entry.dataset.tag === this.activeFilter;
            const visible = matches && shown < 6;
            entry.style.display = visible ? '' : 'none';
            if(matches) shown += 1;
        });
    }

    scheduleSigintTick() {
        if(this.timerId) clearTimeout(this.timerId);
        this.timerId = setTimeout(() => {
            if(!store.get('sigintPaused') && !document.hidden) {
                this.addSigintEntry();
            }
            this.scheduleSigintTick();
        }, 4500 + Math.random() * 3000);
    }

    renderMessage(msg) {
        if(!msg || !msg.tag || !msg.text || !this.feedEl) return;
        const now = new Date();
        const ts = now.toISOString().substr(11, 8);

        const entry = document.createElement('div');
        entry.className = 'sigint-entry';
        entry.dataset.tag = msg.tag;
        this.appendSpan(entry, 'sigint-time', `${ts}Z`);
        this.appendSpan(entry, `sigint-tag ${msg.tag}`, msg.tag.toUpperCase());
        this.appendSpan(entry, 'sigint-text', msg.text);
        
        this.feedEl.insertBefore(entry, this.feedEl.firstChild);

        while(this.feedEl.children.length > 24) {
            this.feedEl.removeChild(this.feedEl.lastChild);
        }
        this.applyFilter();
    }

    addSigintEntry() {
        const msg = sigintMessages[this.sigIdx % sigintMessages.length];
        this.sigIdx++;
        this.renderMessage(msg);
    }
}
