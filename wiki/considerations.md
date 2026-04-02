# Design Considerations

This document records intentional design decisions that may appear ambiguous or paradoxical at first glance. Each entry explains the reasoning so future reviewers do not flag them as bugs.

---

## Round 3 Reserve = 0 (Intentional)

**Apparent issue:** At Round 3, a player deploys exactly 7 cards from their 7-card deck, leaving Reserve = 0. The Battle Preparation phase requires selecting 1 card from reserve to insert — yet there is only 1 card available for the BP step, so there is no card selection choice.

**This is intentional.** Because only 1 card is assigned to the BP step, the player has no alternative cards to choose from. However, the player still decides **where** to insert that card in their lane sequence — the insertion position is entirely user-determined, not automatic.

**Design rationale:** R3 introduces the positioning mechanic in isolation. Players experience the Battle Prep zone and its timeline-manipulation effect with a single decision axis (where to insert) without the added complexity of choosing which card. The full strategic layer (card selection from reserve, benching decisions, reserve management) only opens at R4+ when the deck grows to 9 cards and reserve = 2.

This makes R3 a focused introduction: the insertion positioning mechanic is learned before card selection enters the picture.
