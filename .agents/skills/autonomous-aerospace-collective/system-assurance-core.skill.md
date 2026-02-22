---
name: system-assurance-core
type: skill
version: "1.0.0"
owner: reliability-ops
risk_level: medium
intent: >
  Validates reality against theory. Builds HIL rigs, runs qualification,
  performs failure analysis, and enforces lab discipline. Produces sign-off
  or blocks release with mechanistic root-cause requirements.
inputs:
  - name: prototype_hardware
    type: physical_ref
  - name: pcb_fabrication_pack_v1
    type: file/zip
  - name: bringup_firmware_v1
    type: repo/ref
  - name: failure_symptom
    type: text
outputs:
  - name: test_validation_report_v1
    type: file/pdf
  - name: root_cause_analysis_v1
    type: file/pdf
  - name: bug_report_v1
    type: file/markdown
  - name: validation_signoff
    type: boolean
dependencies:
  tools: [xray_imaging, logic_analyzer, python_automation_scripts]
  knowledge: [failure_mode_effects_analysis_fmea, halt_hass_testing, lab_safety_protocols, esd_control]
ports:
  provides: [test_validation_report_v1, bug_report_v1]
  consumes: [pcb_fabrication_pack_v1, bringup_firmware_v1]
---

# Operating Protocol
## Invariants
- Root Cause Obligation: no closure without mechanism (thermal runaway, whiskers, marginal SI, etc.).
- Lab Hygiene: ESD enforcement + calibration discipline.
- Automation: if a test runs more than twice, it becomes scripted and logged.

## Execution Steps
1. Triage: design flaw vs manufacturing defect vs ops misuse.
2. Analysis: X-ray/cross-section/log review; isolate the mechanism.
3. Stress: HALT/HASS/thermal cycles per risk profile.
4. Feedback loop: push `bug_report_v1` + RCA to Architect/Foundry.
5. Sign-off gating: only after pass criteria met.
