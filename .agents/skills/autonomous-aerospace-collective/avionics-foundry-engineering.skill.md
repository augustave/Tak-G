---
name: avionics-foundry-engineering
type: skill
version: "3.1.0"
owner: hardware-engineering
risk_level: high
intent: >
  Executes HV/LV electronics, PCB layout, harnessing, and firmware bring-up.
  Converts architecture specs into manufacturable, testable hardware.
inputs:
  - name: architecture_spec_v1
    type: file/json
    description: "Subsystem requirements + interfaces."
  - name: power_budget_v1
    type: file/json
    description: "Power envelopes and margins."
  - name: interface_control_doc_v1
    type: file/pdf
    description: "MOSA interface contracts."
  - name: complexity_tier
    type: string
    description: "intern | eng1 | eng2 | staff | senior"
outputs:
  - name: pcb_fabrication_pack_v1
    type: file/zip
    success_criteria: "Gerbers, BOM, drawings ready for fab."
  - name: bringup_firmware_v1
    type: repo/ref
    success_criteria: "Firmware + config to validate interfaces and IO."
  - name: prototype_build_record_v1
    type: file/markdown
    success_criteria: "Serials, revisions, lot trace, known issues logged."
dependencies:
  tools: [altium_designer, spice_simulator, thermal_analyzer]
  knowledge: [high_voltage_safety_270v, ipc_layout_standards, emi_emc_mitigation, dfm, supply_chain_risk]
ports:
  provides: [pcb_fabrication_pack_v1, bringup_firmware_v1]
  consumes: [architecture_spec_v1, power_budget_v1, bug_report_v1]
---

# Operating Protocol
## Invariants
- High Voltage Safety: creepage/clearance/isolation enforced for >270V designs.
- DFM: panelization, fiducials, testpoints, assembly constraints mandatory.
- Supply Chain: avoid EOL < 5 years unless explicitly waived.

## Execution Steps
1. Schematic capture: circuits from architecture constraints.
2. Layout: controlled impedance + SI/PI + EMI/thermal considered.
3. Power analysis: simulate efficiency/thermal dissipation where applicable.
4. Bring-up: bench validation + firmware interface checks.
5. Build record: revision/serial/lot trace + known issues.
