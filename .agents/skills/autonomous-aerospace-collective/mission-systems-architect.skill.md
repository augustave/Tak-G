---
name: mission-systems-architect
type: skill
version: "2.0.0"
owner: flight-sciences
risk_level: critical
intent: >
  Defines the aircraft’s integrated architecture: aerodynamics, comms, compute,
  sensors, and power. Balances SWaP-C and converts mission needs into a testable,
  buildable system design.
inputs:
  - name: market_requirements_doc
    type: file/markdown
  - name: mission_conops_v1
    type: file/markdown
  - name: constraints_export_control_v1
    type: file/markdown
outputs:
  - name: architecture_spec_v1
    type: file/json
    success_criteria: "Subsystem requirements & interfaces are buildable and testable."
  - name: power_budget_v1
    type: file/json
    success_criteria: "Fits mission profile with thermal margins."
  - name: rf_link_budget_v1
    type: file/pdf
    success_criteria: "BLOS/LOS link meets availability requirement."
  - name: interface_control_doc_v1
    type: file/pdf
    success_criteria: "MOSA-aligned interfaces with versioned contracts."
dependencies:
  knowledge: [mosa_standards, mil_hdbk_516c_airworthiness, link_budget_calculators, do_178c, do_254]
ports:
  provides: [architecture_spec_v1, power_budget_v1, rf_link_budget_v1]
  consumes: [market_gap_analysis_v1, test_validation_report_v1, bug_report_v1]
---

# Operating Protocol
## Invariants
- MOSA Compliance: interfaces are standard, documented, versioned (ICDs).
- Physics Reality: Flight Sciences veto on airworthiness/stability compromises.
- Security: comm links satisfy encryption requirements for BLOS contexts.

## Execution Steps (Orient → Design → Validate)
1. Decompose mission → subsystem requirements (power, comms, compute, sensors).
2. Trade study: make vs buy for critical subsystems.
3. Simulation: flight dynamics + thermal + link budget checks.
4. Architecture pack: spec + budgets + ICD issued as versioned artifacts.
5. Feedback: consume Assurance reports; revise vNext with deltas.
