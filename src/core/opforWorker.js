// --- CORE BEHAVIOR TREE CLASSES ---
class Node {
    evaluate(track, tacticalState) { return 'FAILURE'; }
}

class Selector extends Node {
    constructor(children) { super(); this.children = children; }
    evaluate(track, tacticalState) {
        for (let child of this.children) {
            const status = child.evaluate(track, tacticalState);
            if (status === 'SUCCESS' || status === 'RUNNING') return status;
        }
        return 'FAILURE';
    }
}

class Sequence extends Node {
    constructor(children) { super(); this.children = children; }
    evaluate(track, tacticalState) {
        for (let child of this.children) {
            const status = child.evaluate(track, tacticalState);
            if (status === 'FAILURE') return 'FAILURE';
            if (status === 'RUNNING') return 'RUNNING';
        }
        return 'SUCCESS';
    }
}

// --- TACTICAL LEAF NODES (ACTIONS & CONDITIONS) ---

class IsUnderAttack extends Node {
    evaluate(track, tacticalState) {
        // Logic: Check if a Blue Force track is within lethal radius (e.g., 20.0 units)
        if (tacticalState.friendlies.length === 0) return 'FAILURE';
        
        let nearestDistSq = Infinity;
        for (let j = 0; j < tacticalState.friendlies.length; j++) {
            const f = tacticalState.friendlies[j];
            const dx = f.x - track.x;
            const dy = f.y - track.y;
            const distSq = dx*dx + dy*dy;
            if (distSq < nearestDistSq) nearestDistSq = distSq;
        }

        return nearestDistSq < (20.0 * 20.0) ? 'SUCCESS' : 'FAILURE';
    }
}

class ExecuteEvasiveManeuver extends Node {
    evaluate(track, tacticalState) {
        // Logic: Calculate a vector perpendicular and away from the nearest threat
        let nearestF = null;
        let nearestDistSq = Infinity;
        
        for (let j = 0; j < tacticalState.friendlies.length; j++) {
            const f = tacticalState.friendlies[j];
            const dx = f.x - track.x;
            const dy = f.y - track.y;
            const distSq = dx*dx + dy*dy;
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestF = f;
            }
        }

        if (nearestF) {
            // Flee vector (from threat to track)
            const rx = track.x - nearestF.x;
            const ry = track.y - nearestF.y;
            const len = Math.sqrt(rx*rx + ry*ry) || 1;
            
            // Scatter outward and perpendicular
            track.desiredVector = { x: (rx/len) + (ry/len)*0.5, y: (ry/len) - (rx/len)*0.5 };
        } else {
            track.desiredVector = { x: 0, y: 0 };
        }
        
        return 'SUCCESS';
    }
}

class FlankBlueForce extends Node {
    evaluate(track, tacticalState) {
        // Logic: Identify center of mass of Blue Force and aim for the perimeter
        if (tacticalState.friendlies.length === 0) {
            track.desiredVector = { x: 0, y: 0 };
            return 'SUCCESS';
        }

        let cx = 0, cy = 0;
        for (let j = 0; j < tacticalState.friendlies.length; j++) {
            cx += tacticalState.friendlies[j].x;
            cy += tacticalState.friendlies[j].y;
        }
        cx /= tacticalState.friendlies.length;
        cy /= tacticalState.friendlies.length;

        // Vector to Center of Mass
        const rx = cx - track.x;
        const ry = cy - track.y;
        const dist = Math.sqrt(rx*rx + ry*ry) || 1;

        // Flank: If far away, aim toward CoM. If deep, aim perpendicular to the CoM vector (orbit/flank)
        if (dist > 50.0) {
            track.desiredVector = { x: rx/dist, y: ry/dist }; // Approach
        } else {
            // Perpendicular wrap
            track.desiredVector = { x: -ry/dist, y: rx/dist }; 
        }

        return 'SUCCESS';
    }
}

// --- THE OPFOR BRAIN ---
// Priority 1: Survive (Evade if under attack)
// Priority 2: Flank Blue Force
const opforBrain = new Selector([
    new Sequence([
        new IsUnderAttack(),
        new ExecuteEvasiveManeuver()
    ]),
    new FlankBlueForce()
]);

// Memory pool to avoid GC during evaluation
const tacticalState = {
    hostiles: [],
    friendlies: []
};

function parseData(rawData) {
    tacticalState.hostiles.length = 0;
    tacticalState.friendlies.length = 0;
    
    // Format: [x, y, z, id, allegiance]
    for (let i = 0; i < rawData.length; i += 5) {
        const x = rawData[i];
        const y = rawData[i+1];
        // Note: z = rawData[i+2], unused in 2D top-down logic here
        const id = rawData[i+3];
        const allegiance = rawData[i+4];
        
        // Zero in x position means padded out/inactive slot in array buffer
        if (x === 0 && y === 0) continue; 

        if (allegiance === 1) { // 1 = Hostile
            tacticalState.hostiles.push({ id, x, y, desiredVector: {x: 0, y: 0} });
        } else if (allegiance === 0) { // 0 = Friendly
            tacticalState.friendlies.push({ id, x, y });
        }
    }
    return tacticalState;
}

// Listen for the Float32Array from the main thread
self.onmessage = function(e) {
    const rawData = new Float32Array(e.data);
    const state = parseData(rawData); 
    
    const responseBuffer = new Float32Array(state.hostiles.length * 4); // [id, vx, vy, vz]
    
    let wIdx = 0;
    for (let i = 0; i < state.hostiles.length; i++) {
        const hostile = state.hostiles[i];
        
        // Ensure evaluation sets hostile.desiredVector
        opforBrain.evaluate(hostile, state);
        
        // Pack the output vector to send back
        responseBuffer[wIdx++] = hostile.id;
        responseBuffer[wIdx++] = hostile.desiredVector.x;
        responseBuffer[wIdx++] = hostile.desiredVector.y;
        responseBuffer[wIdx++] = 0.0; // Z
    }

    // Transfer back
    self.postMessage(responseBuffer.buffer, [responseBuffer.buffer]);
};
