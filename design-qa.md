# CoffeeCalc design QA

- Source visual truth: `.design/reference-390x844.png`
- Implementation screenshot: `.design/implementation-390x844.png`
- Combined comparison: `.design/comparison-390x844.png`
- Viewport: 390 × 844
- State: Machine Programs home screen with empty program assignments

## Full-view comparison evidence

The combined comparison places the supplied HTML reference on the left and the rebuilt site on the right. The rebuilt shell matches the source's navy 96 px header, centered title, pale slate canvas, 16 px content gutters, vertically stacked white program cards, compact uppercase program labels, italic empty state, and fixed four-item bottom navigation.

The small save-status line is an intentional addition required by the site's online/offline persistence behavior. It does not change the screen's hierarchy or available working space.

## Focused region comparison evidence

A separate crop was not required. At the 390 × 844 source viewport, header typography, all three cards, labels, empty-state text, navigation icons, and navigation labels are readable in the full comparison at native scale.

## Findings

- No remaining P0, P1, or P2 differences.
- P3: The implementation includes a small online/offline save status in the header that is absent from the standalone source. This is an intentional product-state addition and uses subdued contrast so the title remains dominant.

## Required fidelity surfaces

- Fonts and typography: The implementation uses the source's compact system-sans hierarchy, weight, alignment, casing, and italic empty-state treatment.
- Spacing and layout rhythm: Header height, card spacing, gutters, radii, and fixed navigation placement match the source form factor.
- Colors and visual tokens: Navy, slate canvas, white cards, muted slate labels, and blue active-navigation color match the source palette.
- Image quality and asset fidelity: The source contains no raster imagery. Its supplied outline navigation icons were reused directly and remain sharp at the target viewport.
- Copy and content: The home title, assigned-coffee prompt, program names, empty-slot copy, and navigation labels match the source. Newer product copy is contained within its relevant screens.

## Interaction and accessibility checks

- Tested bottom navigation into the dial-in workflow.
- Entered coffee name, grind size, shot time, dose, yield, and strength.
- Verified the 20.67% extraction result and 21.3 g → 47.5 g recommendation.
- Saved the recipe, assigned it to Long Up, and confirmed “Last assigned today” on the program board.
- Confirmed no horizontal overflow at 390 px.
- Confirmed no browser console errors during the primary flow.

## Comparison history

1. P1: The upgraded client entry did not deliver the stylesheet even though the production build passed. Fixed by importing the site stylesheet at the active client entry boundary. Post-fix evidence showed the complete styled shell.
2. P2: The first implementation added a home action row and explanatory empty-card copy that changed the source's above-the-fold density. Moved printing into the Log screen, relied on bottom navigation for dial-in entry, and restored “Empty slot.”
3. Final comparison: No actionable P0, P1, or P2 differences remain.

## Follow-up polish

- Consider whether the save-status line should collapse to a status dot after the team is comfortable with online persistence behavior.

final result: passed
