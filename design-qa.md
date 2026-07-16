# Technician Animal Card Design QA

- Source visual truth: `C:\Users\Acer\AppData\Local\Temp\codex-clipboard-59d65036-83e9-497f-ac4a-4b21a14ceae6.png`
- Implementation: `mobile/features/technician-animals/components/AnimalListCard.tsx`
- Implementation screenshot: unavailable
- Intended viewport: 390 × 844
- Intended state: technician Animal Registry with animal image, tag, owner, reproductive status, and record action

## Full-view comparison evidence

The source card was opened at its original resolution. The implementation follows its visible hierarchy: edge-to-edge animal image, overlaid tag, breed and owner identity row, compact status, and a bordered action panel. A matching browser-rendered implementation screenshot could not be captured because the in-app browser blocked the local Expo preview URL.

## Focused-region comparison evidence

Blocked. Without a rendered implementation screenshot, image crop, text wrapping, status-badge dimensions, dark-mode contrast, and 390 px card spacing cannot be compared visually against the reference.

## Findings

- [P2] Visual comparison remains blocked.
  - Location: `AnimalListCard` at the 390 × 844 mobile viewport.
  - Evidence: the source image is available, but no browser-rendered implementation screenshot could be captured.
  - Impact: exact visual fidelity and runtime wrapping cannot be confirmed from static checks.
  - Fix: open the Technician Animal Registry in Expo Go or Expo web, capture the card at a phone viewport in light and dark mode, and compare it with the source.

## Required fidelity surfaces

- Fonts and typography: Outfit weights and existing app text components are used; visual comparison is blocked.
- Spacing and layout rhythm: responsive full-width card, 154 px media area, 16 px content padding, and 14 px action separation are implemented; visual comparison is blocked.
- Colors and visual tokens: app theme colors drive surfaces, borders, text, and dark mode; visual comparison is blocked.
- Image quality and asset fidelity: existing animal images use `cover`, with the existing icon library for the no-image state; runtime crop comparison is blocked.
- Copy and content: breed, owner, reproductive status, animal tag, and the real record action are sourced from application data; no false next-action date is invented.

## Comparison history

- Initial implementation: converted the compact horizontal row into the reference-inspired image-first card and preserved navigation to the animal record.
- Static validation: TypeScript passed and focused ESLint reported no errors.
- Post-fix visual evidence: unavailable because local browser navigation was blocked.

## Implementation checklist

1. Capture one populated animal card in Expo Go at approximately 390 × 844.
2. Repeat in dark mode.
3. Compare image crop, status width, owner truncation, action-panel spacing, and card radius.

final result: blocked
