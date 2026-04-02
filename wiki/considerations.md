# Design Considerations

This document records intentional design decisions that may appear ambiguous or paradoxical at first glance. Each entry explains the reasoning so future reviewers do not flag them as bugs.

---

## Round 3 Reserve = 0 (Intentional)

**Apparent issue:** At Round 3, a player deploys exactly 7 cards from their 7-card deck, leaving Reserve = 0. The Battle Preparation phase requires selecting 1 card from reserve to insert — yet there are no reserve cards to choose from.

**This is intentional.** The R3 Battle Prep card is not selected from reserve; it is simply inserted directly. There is no strategic decision to make — the player has no alternatives.

**Design rationale:** R3 serves as a deterministic, single-round introduction to the insertion mechanic. Players experience the Battle Prep zone and its timeline-manipulation effect without any cognitive load from selection strategy. The full strategic layer (benching decisions, reserve management) only opens at R4+ when the deck grows to 9 cards and reserve = 2.

This makes R3 a controlled surprise: the mechanic is introduced cleanly before it becomes a full decision point.
