# Handoff — apply GERMANY_T5_PANTHER_F

**Receiver:** operator with RING LAW `src/schema` + `src/game` mounted.
**Authority:** user. Do not self-approve.
**Forbidden:** mutate Entertainment or iron-raid; invent missing hull files; skip tests.

## Ordered steps

1. Confirm `src/schema/catalog.ts` contains `PANTHER_G` and `TREE_LAW.t5.germany` is empty or null.
2. Add `PANTHER_F` from schema/GERMANY_T5_PANTHER_F.md.
3. Set TREE v15 `t5.germany.hullId = "panther-f"`.
4. Wire dummy + reload in sim.
5. Add RING / PEN / TREE / XP / SIM tests listed in the freeze.
6. Run tsc + node test suite.
7. Report pass count. Do not claim Ready without that output.
