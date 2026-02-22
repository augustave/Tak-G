# autonomous-aerospace-collective (file pack)

## Files
- `SWARM.md` — root swarm config + artifact bus + invariants
- `defense-market-vanguard.skill.md`
- `mission-systems-architect.skill.md`
- `avionics-foundry-engineering.skill.md`
- `system-assurance-core.skill.md`

## Usage
- Treat `SWARM.md` as the orchestration contract.
- Each `*.skill.md` is a module with ports (provides/consumes).
- Artifacts named `*_v1` are versioned and should be treated as immutable once issued.
