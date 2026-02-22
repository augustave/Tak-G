import { trackData, sources, confidences } from '../data/mockData.js';

export class TrackManager {
    constructor(overlayGroup) {
        this.overlayGroup = overlayGroup;
        this.trackMeshes = [];
        this.provenanceByTrackId = {};
        this.baseTrackCount = trackData.length;
        this.typeColors = { hostile: 0xff3333, friendly: 0x4a9eff, unknown: 0xffcc00 };
        this.trackDestinations = {};
        
        this.initTracks();
    }

    initTracks() {
        trackData.forEach(t => {
            this.provenanceByTrackId[t.id] = {
                source: sources[Math.floor(Math.random() * sources.length)],
                confidence: confidences[Math.floor(Math.random() * confidences.length)],
                lastUpdate: Date.now() - Math.random() * 300000 // up to 5 mins old
            };

            const color = this.typeColors[t.type];
            let geo;
            if(t.type === 'hostile') {
                const shape = new THREE.Shape();
                shape.moveTo(0, -0.6); shape.lineTo(-0.5, 0.4); shape.lineTo(0.5, 0.4); shape.closePath();
                geo = new THREE.ShapeGeometry(shape);
            } else if(t.type === 'friendly') {
                geo = new THREE.CircleGeometry(0.4, 16);
            } else {
                const shape = new THREE.Shape();
                shape.moveTo(0, 0.5); shape.lineTo(0.5, 0); shape.lineTo(0, -0.5); shape.lineTo(-0.5, 0); shape.closePath();
                geo = new THREE.ShapeGeometry(shape);
            }

            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(t.x, t.y, 0.2);
            mesh.userData = { track: t, baseX: t.x, baseY: t.y, offset: Math.random() * Math.PI * 2 };

            // Hitbox
            const hitGeo = new THREE.CircleGeometry(1.2, 8);
            const hitMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, depthWrite: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.userData = mesh.userData;
            mesh.add(hitMesh);

            // Bracket
            const bracket = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.8, 1.8));
            const bLine = new THREE.LineSegments(bracket, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }));
            mesh.add(bLine);

            // Trail
            const trailGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(-Math.random() * 3, -Math.random() * 3, 0)
            ]);
            const trailMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 });
            mesh.add(new THREE.Line(trailGeo, trailMat));

            // Lock ring
            const lockGeo = new THREE.RingGeometry(0.85, 1.05, 32);
            const lockMat = new THREE.MeshBasicMaterial({ color: 0x00ddff, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
            const lockRing = new THREE.Mesh(lockGeo, lockMat);
            lockRing.position.z = 0.01;
            lockRing.visible = false;
            mesh.add(lockRing);

            mesh.userData.lockRing = lockRing;
            mesh.userData.isSelected = false;

            // Dest marker
            const destMarkerGeo = new THREE.CircleGeometry(0.24, 20);
            const destMarkerMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
            const destMarker = new THREE.Mesh(destMarkerGeo, destMarkerMat);
            destMarker.visible = false;
            destMarker.position.z = 0.08;
            this.overlayGroup.add(destMarker);

            const destLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.05), new THREE.Vector3(0, 0, 0.05)]);
            const destLineMat = new THREE.LineBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.35 });
            const destLine = new THREE.Line(destLineGeo, destLineMat);
            destLine.visible = false;
            this.overlayGroup.add(destLine);

            mesh.userData.destMarker = destMarker;
            mesh.userData.destLine = destLine;

            this.overlayGroup.add(mesh);
            this.trackMeshes.push(mesh);
        });
    }

    getTrackData() {
        return trackData;
    }

    getTrackMeshes() {
        return this.trackMeshes;
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
        this.trackMeshes.forEach(m => {
            const isSelected = m.userData.track.id === selectedId;
            m.userData.isSelected = isSelected;
            m.material.opacity = isSelected ? 1.0 : 0.82;

            const bracket = m.children.find(c => c.type === 'LineSegments');
            if(bracket && bracket.material) {
                bracket.material.color.setHex(isSelected ? 0xffffff : this.typeColors[m.userData.track.type]);
                bracket.material.opacity = isSelected ? 1.0 : 0.5;
                bracket.scale.setScalar(isSelected ? 1.5 : 1.0);
            }

            if (m.userData.lockRing) {
                m.userData.lockRing.visible = isSelected;
                if (!isSelected) {
                    m.userData.lockRing.material.opacity = 0;
                    m.userData.lockRing.scale.setScalar(1);
                }
            }
        });
    }

    updateDestinationVisuals(selectedId) {
        this.trackMeshes.forEach(mesh => {
            const track = mesh.userData.track;
            const dest = this.trackDestinations[track.id];
            const marker = mesh.userData.destMarker;
            const line = mesh.userData.destLine;
            if(!marker || !line) return;

            if(!dest) {
                marker.visible = false;
                line.visible = false;
                return;
            }

            marker.visible = true;
            marker.position.set(dest.x, dest.y, 0.08);
            line.visible = true;
            line.geometry.setFromPoints([
                new THREE.Vector3(mesh.position.x, mesh.position.y, 0.06),
                new THREE.Vector3(dest.x, dest.y, 0.06)
            ]);
            if(line.material) line.material.opacity = mesh.userData.isSelected ? 0.8 : 0.35;
        });
    }
}
