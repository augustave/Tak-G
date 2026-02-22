import { trackData, sources, confidences } from '../data/mockData.js';

export class TrackManager {
    constructor(overlayGroup) {
        this.overlayGroup = overlayGroup;
        this.trackData = trackData;
        this.provenanceByTrackId = {};
        this.trackDestinations = {};
        this.typeColors = { hostile: new THREE.Color(0xff3333), friendly: new THREE.Color(0x4a9eff), unknown: new THREE.Color(0xffcc00) };
        
        this.geometries = {
            hostile: new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, -0.6); s.lineTo(-0.5, 0.4); s.lineTo(0.5, 0.4); s.closePath(); return s; })()),
            friendly: new THREE.CircleGeometry(0.4, 16),
            unknown: new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0.5); s.lineTo(0.5, 0); s.lineTo(0, -0.5); s.lineTo(-0.5, 0); s.closePath(); return s; })())
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
                this.instances[t.type].tracks.push({
                    t: t,
                    baseX: t.x, baseY: t.y, offset: Math.random() * Math.PI * 2
                });
            }
        });

        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            const count = inst.tracks.length;
            if (count === 0) return;
            
            const mat = new THREE.MeshBasicMaterial({ color: this.typeColors[type], transparent: true, opacity: 0.82 });
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

    animateTracks(t, skinVal, effectiveMotion, selectedId) {
        const dummy = new THREE.Object3D();
        let selectedTrackData = null;
        let selectedTrackPos = null;

        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            if(!inst.mesh) return;
            
            inst.mesh.material.opacity = 0.82 * (1 - skinVal);
            
            for(let i = 0; i < inst.tracks.length; i++) {
                const tr = inst.tracks[i];
                const drift = tr.t.spd > 0 ? 0.3 : 0.05;
                const px = tr.baseX + Math.sin(t * 0.3 + tr.offset) * drift * 3;
                const py = tr.baseY + Math.cos(t * 0.25 + tr.offset) * drift * 3;
                
                const timeAngle = t * 0.8 * Math.max(effectiveMotion, 0.08) + tr.offset;
                
                dummy.position.set(px, py, 0.2);
                dummy.rotation.set(0, 0, timeAngle);
                
                const isSelected = tr.t.id === selectedId;
                const sc = isSelected ? 1.15 + Math.sin(t * 3 + tr.offset) * 0.12 : 1 + Math.sin(t * 2 + tr.offset) * 0.15;
                dummy.scale.setScalar(sc);
                
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
