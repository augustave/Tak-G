export class Store {
    constructor() {
        this.state = {
            selectedTrackId: null,
            pendingDesignation: null,
            pendingDesignationStage: 0,
            undoDesignation: null,
            opsLog: [],
            provenanceByTrackId: {},
            isCompactHud: false,
            isHighContrast: false,
            reduceMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            simTime: 0,
            skinMode: 0, // 0 = tactical, 1 = archival
            mapMode: 1, // 1 = topo, 0 = flat
            decoySim: {
                running: false,
                activeDecoys: [],
                burstCount: 0
            },
            sigintPaused: false
        };
        this.listeners = {};
    }

    subscribe(key, callback) {
        if (!this.listeners[key]) this.listeners[key] = [];
        this.listeners[key].push(callback);
        // Fire immediately with current state
        callback(this.state[key], null);
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }

    set(key, value) {
        const oldValue = this.state[key];
        if (oldValue !== value) {
            this.state[key] = value;
            if (this.listeners[key]) {
                this.listeners[key].forEach(cb => cb(value, oldValue));
            }
        }
    }

    get(key) {
        return this.state[key];
    }
}

export const store = new Store();
