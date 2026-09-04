# RING LAW

Nation-tree tank range. Schema-first. App Builder sandbox was the live source. That sandbox is not mounted here.

## Do not

- Patch `SnakeWard/Entertainment` or `iron-raid`.
- Invent `catalog.ts` from memory and call it the game.
- Claim compile/test evidence you do not have.

## Frozen and waiting to apply

Germany T5 = Panther Ausf. F (Schmalturm). Same KwK 42. G hull. Turret 120 @ 20°.

See [schema/GERMANY_T5_PANTHER_F.md](schema/GERMANY_T5_PANTHER_F.md).

## How to apply

1. Reopen the RING LAW App Builder chat, or drop the original `src/schema` + `src/game` into this repo.
2. Tell the operator: apply GERMANY_T5_PANTHER_F.
3. Run `tsc` and `node --experimental-strip-types --test src/schema/*.test.ts src/game/sim.test.ts`.

TREE LAW target after apply: v15. T5 filled M4A3 / T-44 / Panther F.
