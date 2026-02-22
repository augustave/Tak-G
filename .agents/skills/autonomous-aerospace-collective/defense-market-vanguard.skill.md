---
name: defense-market-vanguard
type: skill
version: "1.0.0"
owner: business-development
risk_level: medium
intent: >
  Orchestrates go-to-market strategies for autonomous defense systems in the
  Middle East (Saudi/UAE focus). Translates geopolitical needs into product
  requirements that engineering can implement and validate.
inputs:
  - name: regional_intelligence
    type: text
    description: "Procurement cycles, MoD priorities, primes, offsets."
  - name: customer_signals
    type: text
    description: "Operator pain, mission profile, terrain/climate constraints."
  - name: technical_capabilities
    type: json
    description: "Current specs (range, payload, links, thermal limits)."
outputs:
  - name: market_requirements_doc
    type: file/markdown
  - name: mission_conops_v1
    type: file/markdown
  - name: capture_strategy_deck
    type: file/pptx
dependencies:
  knowledge: [foreign_military_sales_fms, itar_compliance, regional_cultural_protocols, fcpa]
ports:
  provides: [market_gap_analysis_v1]
  consumes: [test_validation_report_v1, validated_claims_sheet_v1]
---

# Operating Protocol
## Invariants
- Compliance: export controls + FCPA; no “workarounds”.
- Cultural Fluency: localized language + business etiquette for MENA.
- Evidence: claims must be backed by validated telemetry/tests (no speculative marketing).

## Execution Steps
1. Intel synthesis: stakeholder map + procurement path.
2. Gap analysis: need vs current aircraft capability.
3. CONOPS draft: mission narrative engineering can simulate.
4. Capture packaging: claims sheet + deck.
