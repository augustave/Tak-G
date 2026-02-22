import { store } from './core/Store.js';
import { setupMapEngine } from './core/MapEngine.js';
import { TrackManager } from './core/TrackManager.js';
import { SigintFeed } from './core/SigintFeed.js';
import { OpsLog } from './core/OpsLog.js';
import { DecoySim } from './core/DecoySim.js';
import { HUDController } from './core/HUDController.js';
import { DOMController } from './core/DOMController.js';

// Setup Map
const container = document.getElementById('canvas-container');
const mapEngine = setupMapEngine(container);

// Setup Controllers & Systems
const opsLog = new OpsLog();
const sigintFeed = new SigintFeed();
const decoySim = new DecoySim(sigintFeed, opsLog);
const hudController = new HUDController();
const trackManager = new TrackManager(mapEngine.overlayGroup);
const domController = new DOMController(trackManager, opsLog);

// Logic: Interactions
const raycaster = new THREE.Raycaster();
const mClick = new THREE.Vector2();

function getTrackFromObject(object) {
    let current = object;
    while (current) {
        if (current.userData && current.userData.track) return current.userData.track;
        current = current.parent;
    }
    return null;
}

window.addEventListener('mousedown', e => {
    if(store.get('pendingDesignation')) return;
    if(e.target.closest('#hud .panel') || e.target.closest('#skin-toggle') || e.target.closest('#confirm-strip') || e.target.closest('#undo-strip') || e.target.closest('.drawer-toggle')) return;
    hudController.closeDrawers();
    
    mClick.x = (e.clientX / window.innerWidth) * 2 - 1;
    mClick.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mClick, mapEngine.camera);
    
    const trackHits = raycaster.intersectObjects(trackManager.getTrackMeshes(), true);
    if(trackHits.length > 0) {
        for (const hit of trackHits) {
            const track = getTrackFromObject(hit.object);
            if(track) {
                domController.selectTrack(track.id);
                return;
            }
        }
    }

    const mapHits = raycaster.intersectObject(mapEngine.mapMesh);
    const selectedTrackId = store.get('selectedTrackId');
    if(mapHits.length > 0 && selectedTrackId) {
        const p = mapHits[0].point;
        if(domController.destinationMode) {
            const mgrsE = Math.floor(48250 + p.x * 50);
            const mgrsN = Math.floor(17530 + (-p.z) * 50);
            const mgrsString = `38TLN ${String(mgrsE).padStart(5,'0')} ${String(mgrsN).padStart(5,'0')}`;
            
            trackManager.setDestination(selectedTrackId, { x: p.x, y: -(p.z), mgrs: mgrsString });
            opsLog.addEntry('DESTINATION', selectedTrackId, `SET TO ${mgrsString}`);
            
            domController.destinationMode = false;
            domController.setDestinationButtonEl.classList.remove('active');
            domController.setDestinationButtonEl.textContent = 'SET DEST';
            
            const track = trackManager.getTrackData().find(t => t.id === selectedTrackId);
            if(track) domController.updateActiveTrackPanel(track);
            return;
        }

        const mx = p.x;
        const mgrsE = Math.floor(48250 + mx * 50);
        const mgrsN = Math.floor(17530 + (-p.z) * 50);
        const mgrsString = `38TLN ${String(mgrsE).padStart(5,'0')} ${String(mgrsN).padStart(5,'0')}`;
        
        store.set('pendingDesignation', { x: p.x, z: p.z, mgrs: mgrsString, trackId: selectedTrackId });
        domController.confirmStrip.style.display = 'flex';
        domController.confirmStrip.style.left = e.clientX + 'px';
        domController.confirmStrip.style.top = e.clientY + 'px';
        domController.confirmTarget.textContent = `${selectedTrackId} @ ${mgrsString}`;
        domController.setDesignationStage(1);
        
        const prov = trackManager.getProvenance(selectedTrackId);
        if(prov && prov.confidence === 'LOW') {
            domController.reasonSelect.style.display = 'block';
            domController.reasonSelect.value = "VISUAL_CORROBORATION";
        } else {
            domController.reasonSelect.style.display = 'none';
        }
        return;
    }
    
    if(mapHits.length > 0 && !selectedTrackId) {
        const p = mapHits[0].point;
        mapEngine.explosions[window.expIdx || 0].set(p.x, p.z, 0.01);
        window.expIdx = ((window.expIdx || 0) + 1) % 8;
    }
});

// Setup hook inside commitDesignation 
// (We should wrap the original logic to also set explosion)
const originalCommit = domController.commitDesignation.bind(domController);
domController.commitDesignation = function() {
    const pending = store.get('pendingDesignation');
    if(pending) {
        mapEngine.explosions[window.expIdx || 0].set(pending.x, pending.z, 0.01);
        window.expIdx = ((window.expIdx || 0) + 1) % 8;
    }
    originalCommit();
}

// Logic: Keyboard
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    const undoDesignation = store.get('undoDesignation');
    if(undoDesignation && key === 'u') {
        e.preventDefault();
        domController.undoLastDesignation();
        return;
    }

    const pending = store.get('pendingDesignation');
    if(pending) {
        const tag = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '';
        if(tag === 'input' || tag === 'textarea') return;
        if(tag === 'select' && e.key !== 'Escape') return;

        if(e.key === 'Escape') {
            store.set('pendingDesignation', null);
            domController.hideConfirmStrip();
            return;
        }

        const stage = store.get('pendingDesignationStage');
        if(stage === 1 && (key === 'r' || e.key === 'Enter')) {
            e.preventDefault();
            domController.setDesignationStage(2);
            return;
        }

        if(stage === 2 && e.key === 'Enter') {
            e.preventDefault();
            domController.commitDesignation();
        }
        return;
    }

    const tag = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '';
    if(tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if(e.key === 'ArrowDown') {
        e.preventDefault();
        selectRelativeTrack(1);
        return;
    }
    if(e.key === 'ArrowUp') {
        e.preventDefault();
        selectRelativeTrack(-1);
        return;
    }
    if(key === 'd') {
        e.preventDefault();
        store.set('isCompactHud', !store.get('isCompactHud'));
        return;
    }
    if(key === 'h') {
        e.preventDefault();
        store.set('isHighContrast', !store.get('isHighContrast'));
        return;
    }
    if(key === 'm') {
        e.preventDefault();
        store.set('reduceMotion', !store.get('reduceMotion'));
        return;
    }
    if(key === '[') {
        e.preventDefault();
        hudController.toggleDrawer('left');
        return;
    }
    if(key === ']') {
        e.preventDefault();
        hudController.toggleDrawer('right');
        return;
    }
    if(e.key === 'Escape') {
        hudController.closeDrawers();
    }
});

function selectRelativeTrack(step) {
    const trackData = trackManager.getTrackData();
    if(trackData.length === 0) return;
    const selectedId = store.get('selectedTrackId');
    const idx = trackData.findIndex(t => t.id === selectedId);
    const base = idx === -1 ? 0 : idx;
    const next = (base + step + trackData.length) % trackData.length;
    domController.selectTrack(trackData[next].id);
}

// Logic: Animate
let lastFrameTs = 0;
let lastHiddenRenderTs = 0;
const compassNeedle = document.getElementById('compass-needle');

function animate(ts) {
    requestAnimationFrame(animate);
    if(lastFrameTs === 0) lastFrameTs = ts;
    const dt = Math.min((ts - lastFrameTs) / 1000, 0.1);
    lastFrameTs = ts;

    if(document.hidden && ts - lastHiddenRenderTs < 160) return;
    if(document.hidden) lastHiddenRenderTs = ts;

    const reduceMotion = store.get('reduceMotion');
    const motionScale = reduceMotion ? 0.45 : 1.0;
    const effectiveMotion = (document.hidden ? 0.25 : 1.0) * motionScale;
    
    // update simTime
    const simTime = store.get('simTime') + dt * effectiveMotion;
    store.set('simTime', simTime);
    const t = simTime;

    const targetSkin = store.get('skinMode');
    mapEngine.uniforms.time.value = t;
    mapEngine.uniforms.uSkinMode.value = THREE.MathUtils.lerp(mapEngine.uniforms.uSkinMode.value, targetSkin, 0.04);
    const skinVal = mapEngine.uniforms.uSkinMode.value;

    const activeTrackPanel = document.getElementById('active-track-panel');
    const opsLogPanel = document.getElementById('ops-log-panel');
    if(activeTrackPanel) activeTrackPanel.style.opacity = (1 - skinVal).toFixed(2);
    if(opsLogPanel) opsLogPanel.style.opacity = (1 - skinVal).toFixed(2);

    mapEngine.overlayGroup.traverse(child => {
        if(child.material) {
            if(child.userData.baseOp === undefined) {
                child.userData.baseOp = child.material.opacity;
                child.material.transparent = true;
            }
            child.material.opacity = child.userData.baseOp * (1 - skinVal);
        }
    });

    for(let i = 0; i < 8; i++) {
        if(mapEngine.explosions[i].z > 0) {
            mapEngine.explosions[i].z += 0.008;
            if(mapEngine.explosions[i].z > 1) mapEngine.explosions[i].z = 0;
        }
    }

    mapEngine.radarMesh.rotation.z -= 0.015 * Math.max(effectiveMotion, 0.08);

    const selectedTrackId = store.get('selectedTrackId');
    trackManager.getTrackMeshes().forEach(m => {
        const d = m.userData;
        const drift = d.track.spd > 0 ? 0.3 : 0.05;
        m.position.x = d.baseX + Math.sin(t * 0.3 + d.offset) * drift * 3;
        m.position.y = d.baseY + Math.cos(t * 0.25 + d.offset) * drift * 3;
        const isSelected = Boolean(d.isSelected);
        const sc = isSelected ? 1.15 + Math.sin(t * 3 + d.offset) * 0.12 : 1 + Math.sin(t * 2 + d.offset) * 0.15;
        m.scale.set(sc, sc, 1);
        if(m.material) {
            const mult = isSelected ? 1.25 : 0.95;
            m.material.opacity = Math.min(1, d.baseOp * (1 - skinVal) * mult);
        }
        if(d.lockRing && d.lockRing.material) {
            if(isSelected) {
                const pulse = (Math.sin(t * 7) + 1) * 0.5;
                d.lockRing.visible = true;
                d.lockRing.material.opacity = (0.18 + pulse * 0.35) * (1 - skinVal);
                d.lockRing.scale.setScalar(1.0 + pulse * 0.28);
            } else {
                d.lockRing.visible = false;
                d.lockRing.material.opacity = 0;
                d.lockRing.scale.setScalar(1);
            }
        }
        if(m.children[0]) m.children[0].rotation.z += 0.008 * Math.max(effectiveMotion, 0.08);
    });

    trackManager.updateDestinationVisuals(selectedTrackId);

    const camAngle = t * 0.06;
    mapEngine.camera.position.x = Math.sin(camAngle) * 6 + Math.sin(t * 1.7) * 0.15;
    mapEngine.camera.position.z = 33 + Math.cos(camAngle * 0.8) * 4;
    mapEngine.camera.position.y = 45 + Math.sin(t * 0.4) * 1.5;
    mapEngine.camera.lookAt(Math.sin(t * 0.08) * 2, 0, Math.cos(t * 0.06) * 2);

    const heading = (camAngle * 180 / Math.PI) % 360;
    if(compassNeedle) compassNeedle.style.transform = `translate(-50%, -100%) rotate(${-heading}deg)`;

    mapEngine.renderer.render(mapEngine.scene, mapEngine.camera);
}

window.addEventListener('resize', () => {
    mapEngine.camera.aspect = window.innerWidth / window.innerHeight;
    mapEngine.camera.updateProjectionMatrix();
    mapEngine.renderer.setSize(window.innerWidth, window.innerHeight);
    if(window.innerWidth > 1100) hudController.closeDrawers();
});

requestAnimationFrame(animate);
