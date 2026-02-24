import { trackData, sources, confidences, loadScenario } from '../data/mockData.js';

export class TrackManager {
    constructor(overlayGroup) {
        this.overlayGroup = overlayGroup;
        this.trackData = trackData;
        this.provenanceByTrackId = {};
        this.trackDestinations = {};
        this.typeColors = { hostile: new THREE.Color(0xff3333), friendly: new THREE.Color(0x4a9eff), unknown: new THREE.Color(0xffcc00) };
        
        this.geometries = {
            // Hostile: Diamond with a tail
            hostile: new THREE.ShapeGeometry((() => { 
                const s = new THREE.Shape(); 
                s.moveTo(0, -0.6); s.lineTo(-0.5, 0.4); s.lineTo(0, 0.2); s.lineTo(0.5, 0.4); s.closePath(); 
                return s; 
            })()),
            
            // Friendly: Circle with a tail
            friendly: new THREE.ShapeGeometry((() => { 
                const s = new THREE.Shape(); 
                s.absarc(0, 0, 0.4, 0, Math.PI * 2, false);
                s.moveTo(-0.2, 0.35); s.lineTo(0, 0.8); s.lineTo(0.2, 0.35); // Tail pointing "back"
                return s; 
            })()),
            
            // Unknown: Square with a tail
            unknown: new THREE.ShapeGeometry((() => { 
                const s = new THREE.Shape(); 
                s.moveTo(0, 0.5); s.lineTo(0.5, 0); s.lineTo(0.2, -0.3); s.lineTo(0, -0.8); s.lineTo(-0.2, -0.3); s.lineTo(-0.5, 0); s.closePath(); 
                return s; 
            })())
        };
        
        this.instances = {
            hostile: { mesh: null, tracks: [] },
            friendly: { mesh: null, tracks: [] },
            unknown: { mesh: null, tracks: [] }
        };

        this.initTracks();
    }

    initTracks() {
        this.trackData.forEach(t => {
            this.provenanceByTrackId[t.id] = {
                source: sources[Math.floor(Math.random() * sources.length)],
                confidence: confidences[Math.floor(Math.random() * confidences.length)],
                lastUpdate: Date.now() - Math.random() * 300000
            };
            
            if (this.instances[t.type]) {
                const isSwarm = t.subtype === 'UAS SWARM';
                const angle = Math.random() * Math.PI * 2;
                this.instances[t.type].tracks.push({
                    t: t,
                    baseX: t.x, baseY: t.y, offset: Math.random() * Math.PI * 2,
                    isSwarm: isSwarm,
                    alerted: false, // Track if we've fired the 60s warning
                    pos: new THREE.Vector2(t.x, t.y),
                    vel: isSwarm ? new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar((t.spd / 120) * 0.5 + 0.1) : null
                });
            }
        });

        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            const count = inst.tracks.length;
            if (count === 0) return;
            
            // Dim unknown tracks significantly so they are less dense/distracting on the terrain
            const baseOpacity = type === 'unknown' ? 0.25 : 0.82;
            const mat = new THREE.MeshBasicMaterial({ color: this.typeColors[type], transparent: true, opacity: baseOpacity });
            inst.mesh = new THREE.InstancedMesh(this.geometries[type], mat, count);
            inst.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            inst.mesh.userData = { isTrackInstancedMesh: true, type: type };
            
            // Dummy setup to ensure bounding sphere allows raycasting initially
            const dummy = new THREE.Object3D();
            for(let i=0; i<count; i++) {
                dummy.position.set(inst.tracks[i].baseX, inst.tracks[i].baseY, 0.2);
                dummy.updateMatrix();
                inst.mesh.setMatrixAt(i, dummy.matrix);
            }
            // inst.mesh.geometry.computeBoundingSphere();
            // inst.mesh.geometry.computeBoundingBox();

            this.overlayGroup.add(inst.mesh);
        });

        this.setupSelectionVisuals();
    }

    setupSelectionVisuals() {
        if (this.selectionGroup) return; // Already exists

        this.selectionGroup = new THREE.Group();
        this.selectionGroup.visible = false;
        this.overlayGroup.add(this.selectionGroup);

        const lockGeo = new THREE.RingGeometry(0.85, 1.05, 32);
        const lockMat = new THREE.MeshBasicMaterial({ color: 0x00ddff, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
        this.lockRing = new THREE.Mesh(lockGeo, lockMat);
        this.lockRing.position.z = 0.01;
        this.selectionGroup.add(this.lockRing);

        const bracketGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.8, 1.8));
        this.bracketLine = new THREE.LineSegments(bracketGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 }));
        this.selectionGroup.add(this.bracketLine);

        const destMarkerGeo = new THREE.CircleGeometry(0.24, 20);
        const destMarkerMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
        this.destMarker = new THREE.Mesh(destMarkerGeo, destMarkerMat);
        this.destMarker.visible = false;
        this.overlayGroup.add(this.destMarker);

        const destLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const destLineMat = new THREE.LineBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.35 });
        this.destLine = new THREE.Line(destLineGeo, destLineMat);
        this.destLine.visible = false;
        this.overlayGroup.add(this.destLine);
    }

    resetScenario(profile) {
        if (profile === 'clear') {
            trackData.length = 0;
        } else {
            loadScenario(profile);
        }
        
        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            if(inst.mesh) {
                this.overlayGroup.remove(inst.mesh);
                inst.mesh.geometry.dispose();
                inst.mesh.material.dispose();
                inst.mesh = null;
            }
            inst.tracks = [];
        });
        
        if (window.store) {
            window.store.set('selectedTrackId', null);
            window.store.set('reconMode', false);
        }
        
        this.initTracks();
    }

    getTrackData() {
        return this.trackData;
    }

    getTrackMeshes() {
        return Object.values(this.instances).map(inst => inst.mesh).filter(m => m !== null);
    }

    getProvenance(id) {
        return this.provenanceByTrackId[id];
    }

    setDestination(id, destObj) {
        this.trackDestinations[id] = destObj;
    }

    getDestination(id) {
        return this.trackDestinations[id];
    }

    clearDestination(id) {
        if(this.trackDestinations[id]) {
            delete this.trackDestinations[id];
            return true;
        }
        return false;
    }

    updateSelectionVisuals(selectedId) {
        // Now handled per-frame in animateTracks
    }

    updateDestinationVisuals(selectedId) {
        // Now handled per-frame in animateTracks
    }

    updateSwarmBoids(dt) {
        const swarms = [];
        Object.values(this.instances).forEach(inst => {
            inst.tracks.forEach(tr => {
                if (tr.isSwarm) swarms.push({ tr, type: inst.mesh.userData.type });
            });
        });

        // Optimization: Spatial Hash Grid
        const grid = new Map();
        const CELL_SIZE = 2.0;
        
        for (let i = 0; i < swarms.length; i++) {
            const tr = swarms[i].tr;
            const key = Math.floor(tr.pos.x / CELL_SIZE) + ',' + Math.floor(tr.pos.y / CELL_SIZE);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(swarms[i]);
        }

        const ALIGN_WEIGHT = 0.8;
        const COHESION_WEIGHT = 0.5;
        const SEPARATION_WEIGHT = 1.8;
        const HUNT_WEIGHT = 1.2;
        const MAX_SPEED = 5.0; 
        const MAX_FORCE = 3.0;

        for (let i = 0; i < swarms.length; i++) {
            const item = swarms[i];
            const tr = item.tr;
            
            const cx = Math.floor(tr.pos.x / CELL_SIZE);
            const cy = Math.floor(tr.pos.y / CELL_SIZE);
            
            let align = new THREE.Vector2();
            let cohesion = new THREE.Vector2();
            let separation = new THREE.Vector2();
            let hunt = new THREE.Vector2();
            
            let neighborCount = 0;
            let huntCount = 0;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const key = (cx + dx) + ',' + (cy + dy);
                    const cell = grid.get(key);
                    if (cell) {
                        for (let j = 0; j < cell.length; j++) {
                            const otherItem = cell[j];
                            if (otherItem.tr !== tr) {
                                const distSq = tr.pos.distanceToSquared(otherItem.tr.pos);
                                if (distSq < CELL_SIZE * CELL_SIZE && distSq > 0.0001) {
                                    const dist = Math.sqrt(distSq);
                                    if (item.type === otherItem.type) {
                                        align.add(otherItem.tr.vel);
                                        cohesion.add(otherItem.tr.pos);
                                        
                                        if (dist < CELL_SIZE * 0.4) {
                                            const diff = tr.pos.clone().sub(otherItem.tr.pos).normalize().divideScalar(dist);
                                            separation.add(diff);
                                        }
                                        neighborCount++;
                                    } 
                                    else if ((item.type === 'friendly' && otherItem.type === 'hostile') || 
                                             (item.type === 'hostile' && otherItem.type === 'friendly')) {
                                        hunt.add(otherItem.tr.pos);
                                        huntCount++;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let steer = new THREE.Vector2();

            if (neighborCount > 0) {
                align.divideScalar(neighborCount);
                if (align.lengthSq() > 0) align.setLength(MAX_SPEED).sub(tr.vel);
                
                cohesion.divideScalar(neighborCount).sub(tr.pos);
                if (cohesion.lengthSq() > 0) cohesion.setLength(MAX_SPEED).sub(tr.vel);
                
                separation.divideScalar(neighborCount);
                if(separation.lengthSq() > 0) separation.setLength(MAX_SPEED).sub(tr.vel);

                steer.add(align.multiplyScalar(ALIGN_WEIGHT));
                steer.add(cohesion.multiplyScalar(COHESION_WEIGHT));
                steer.add(separation.multiplyScalar(SEPARATION_WEIGHT));
            }
            
            if (huntCount > 0) {
                hunt.divideScalar(huntCount).sub(tr.pos);
                if(hunt.lengthSq() > 0) hunt.setLength(MAX_SPEED).sub(tr.vel);
                steer.add(hunt.multiplyScalar(HUNT_WEIGHT));
            }

            // Boundary avoidance
            const mapLimit = 36.0;
            if (tr.pos.x < -mapLimit) steer.x += MAX_FORCE;
            if (tr.pos.x > mapLimit) steer.x -= MAX_FORCE;
            if (tr.pos.y < -mapLimit) steer.y += MAX_FORCE;
            if (tr.pos.y > mapLimit) steer.y -= MAX_FORCE;

            if (steer.lengthSq() > MAX_FORCE * MAX_FORCE) steer.setLength(MAX_FORCE);
            
            tr.vel.add(steer.multiplyScalar(dt));
            if (tr.vel.lengthSq() > MAX_SPEED * MAX_SPEED) tr.vel.setLength(MAX_SPEED);
            
            tr.pos.add(tr.vel.clone().multiplyScalar(dt));
        }
    }

    animateTracks(t, skinVal, effectiveMotion, selectedId) {
        if (this.lastTime === undefined) this.lastTime = t;
        const dt = Math.min(t - this.lastTime, 0.1);
        this.lastTime = t;

        if (dt > 0 && effectiveMotion > 0) {
            this.updateSwarmBoids(dt * effectiveMotion);
        }

        const dummy = new THREE.Object3D();
        let selectedTrackData = null;
        let selectedTrackPos = null;

        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            if(!inst.mesh) return;
            
            inst.mesh.material.opacity = 0.82 * (1 - skinVal);
            
            const color = new THREE.Color();
            
            for(let i = 0; i < inst.tracks.length; i++) {
                const tr = inst.tracks[i];
                let px, py;
                
                if (tr.isSwarm) {
                    px = tr.pos.x;
                    py = tr.pos.y;
                } else {
                    const drift = tr.t.spd > 0 ? 0.3 : 0.05;
                    px = tr.baseX + Math.sin(t * 0.3 + tr.offset) * drift * 3;
                    py = tr.baseY + Math.cos(t * 0.25 + tr.offset) * drift * 3;
                    tr.pos.set(px, py); // Keep pos updated for potential interactions
                }
                
                let timeAngle;
                if (tr.isSwarm) {
                    // Geometry tip points down (0, -0.6), so align with velocity vector + 90 degrees
                    timeAngle = Math.atan2(tr.vel.y, tr.vel.x) + Math.PI / 2;
                } else {
                    timeAngle = t * 0.8 * Math.max(effectiveMotion, 0.08) + tr.offset;
                }
                
                dummy.position.set(px, py, 0.2);
                dummy.rotation.set(0, 0, timeAngle);
                
                const isSelected = tr.t.id === selectedId;
                const sc = isSelected ? 1.15 + Math.sin(t * 3 + tr.offset) * 0.12 : 1 + Math.sin(t * 2 + tr.offset) * 0.15;
                dummy.scale.setScalar(sc);
                
                // Urgency Encoding: High Threat & < 60s
                if (effectiveMotion > 0) {
                    tr.t.time_to_event_seconds = Math.max(0, tr.t.time_to_event_seconds - dt * effectiveMotion);
                }
                
                if (tr.t.threat_level === 'HIGH' && tr.t.time_to_event_seconds < 60) {
                    if (!tr.alerted && window.opsLogInstance) {
                        tr.alerted = true;
                        window.opsLogInstance.addEntry('CRITICAL', tr.t.id, `HIGH THREAT IMMINENT: T-MINUS ${Math.floor(tr.t.time_to_event_seconds)}s`, 2, tr.t.time_to_event_seconds);
                    }
                    // Fast pulsing red/white
                    const urgentPulse = (Math.sin(t * 15 + tr.offset) + 1) * 0.5;
                    color.setHex(urgentPulse > 0.5 ? 0xffffff : 0xff0000);
                    inst.mesh.setColorAt(i, color);
                } else {
                    inst.mesh.setColorAt(i, this.typeColors[type]);
                }
                
                dummy.updateMatrix();
                inst.mesh.setMatrixAt(i, dummy.matrix);
                
                if (isSelected) {
                    selectedTrackData = tr.t;
                    selectedTrackPos = { x: px, y: py };
                    
                    this.selectionGroup.position.set(px, py, 0.2);
                    this.selectionGroup.scale.setScalar(sc);
                    
                    const pulse = (Math.sin(t * 7) + 1) * 0.5;
                    this.lockRing.material.opacity = (0.18 + pulse * 0.35) * (1 - skinVal);
                    this.lockRing.scale.setScalar(1.0 + pulse * 0.28);
                    this.bracketLine.material.opacity = 1.0 * (1 - skinVal);
                    this.bracketLine.material.color = this.typeColors[type];
                }
            }
            inst.mesh.instanceMatrix.needsUpdate = true;
            if (inst.mesh.instanceColor) inst.mesh.instanceColor.needsUpdate = true;
            if(inst.mesh.geometry.boundingSphere === null) {
                inst.mesh.geometry.computeBoundingSphere();
            }
        });

        if (!selectedId || !selectedTrackPos) {
            this.selectionGroup.visible = false;
            this.destMarker.visible = false;
            this.destLine.visible = false;
        } else {
            this.selectionGroup.visible = true;
            this.lockRing.visible = true;
            
            const dest = this.trackDestinations[selectedId];
            if (dest) {
                this.destMarker.position.set(dest.x, dest.y, 0.08);
                this.destMarker.visible = true;
                this.destLine.geometry.setFromPoints([
                    new THREE.Vector3(selectedTrackPos.x, selectedTrackPos.y, 0.06),
                    new THREE.Vector3(dest.x, dest.y, 0.06)
                ]);
                this.destLine.material.opacity = 0.8 * (1 - skinVal);
                this.destLine.visible = true;
            } else {
                this.destMarker.visible = false;
                this.destLine.visible = false;
            }
        }
    }
}
