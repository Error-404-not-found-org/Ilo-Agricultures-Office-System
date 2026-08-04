---
name: "BreedSmart Mobile"
description: "A calm, durable field-service interface for livestock care and municipal operations."
colors:
  field-green: "#00643B"
  field-green-bright: "#10B981"
  field-green-soft: "#F0FDF4"
  field-green-deep: "#064E3B"
  canvas-light: "#F8FAFC"
  surface-light: "#FFFFFF"
  surface-subtle-light: "#F1F5F9"
  outline-light: "#CBD5E1"
  control-outline-light: "#F3F4F6"
  ink-light: "#1E293B"
  ink-secondary-light: "#475569"
  ink-muted-light: "#64748B"
  canvas-dark: "#090D16"
  surface-dark: "#111827"
  surface-subtle-dark: "#1F2937"
  outline-dark: "#374151"
  control-outline-dark: "#1E293B"
  ink-dark: "#F8FAFC"
  ink-secondary-dark: "#CBD5E1"
  ink-muted-dark: "#9CA3AF"
  success-light: "#047857"
  success-dark: "#34D399"
  warning-light: "#A16207"
  warning-dark: "#FBBF24"
  danger-light: "#B91C1C"
  danger-dark: "#F87171"
  information-light: "#1D4ED8"
  information-dark: "#60A5FA"
typography:
  headline:
    fontFamily: "Outfit"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: "30px"
  title:
    fontFamily: "Outfit"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "24px"
  body:
    fontFamily: "Outfit"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  body-strong:
    fontFamily: "Outfit"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  label:
    fontFamily: "Outfit"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0px"
  caption:
    fontFamily: "Outfit"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.field-green}"
    textColor: "{colors.surface-light}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "{spacing.3} {spacing.4}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.field-green}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "{spacing.3} {spacing.4}"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.danger-light}"
    textColor: "{colors.surface-light}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "{spacing.3} {spacing.4}"
    height: "48px"
  input:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.3} {spacing.4}"
    height: "48px"
  chip:
    backgroundColor: "{colors.surface-subtle-light}"
    textColor: "{colors.ink-secondary-light}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.2} {spacing.3}"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.field-green-soft}"
    textColor: "{colors.field-green}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.2} {spacing.3}"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.lg}"
    padding: "{spacing.4}"
  list-row:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.3} {spacing.4}"
    height: "56px"
---

# Design System: BreedSmart Mobile

## 1. Overview

**Creative North Star: "Field Ledger"**

BreedSmart Mobile should feel like a durable field notebook translated into a modern service tool: calm, direct, high-contrast, and dependable in bright outdoor conditions. Information is organized in compact, legible rows and clearly titled sections so a farmer or technician can understand the next action without decoding the interface.

The design is task-first rather than decorative. It uses neutral canvas and surface layers, with BreedSmart green reserved for navigation, selection, and primary action. It explicitly rejects marketing-page layouts, decorative bento grids, glassmorphism, oversized empty hero sections, and motion-heavy dashboards.

The same visual grammar serves every role while preserving role identity through content, permissions, labels, and navigation. Farmer screens prioritize requests and animal history; technician screens prioritize assigned work, new requests, visits, and diagnostic follow-up; admin screens prioritize oversight and exceptions.

**Key Characteristics:**

- Durable, calm, and professional
- Compact enough for field work without feeling crowded
- High-contrast in light and dark mode
- Flat by default, with elevation used only to clarify hierarchy
- Consistent across farmer, technician, and admin workflows
- Built from reusable React Native primitives and semantic tokens

## 2. Colors

The palette combines municipal reliability with agricultural familiarity: deep field green carries action and identity while slate neutrals carry almost all content.

### Primary

- **Field Green** (#00643B): Primary actions, selected navigation, active filters, focused controls, and key brand marks in light mode.
- **Bright Field Green** (#10B981): Dark-mode primary actions and active states where the deeper green would lose contrast.
- **Field Wash** (#F0FDF4): Selected rows, positive context, and quiet green containers in light mode.
- **Deep Grove** (#064E3B): Dark-mode green containers and restrained brand surfaces.

### Semantic

- **Verified Green** (#047857 light / #34D399 dark): Completed, healthy, synchronized, or otherwise successful states.
- **Review Ochre** (#A16207 light / #FBBF24 dark): Pending review, due soon, incomplete evidence, or attention-required states.
- **Action Red** (#B91C1C light / #F87171 dark): Destructive actions, failed operations, and urgent problems only.
- **Information Blue** (#1D4ED8 light / #60A5FA dark): Neutral informational states that are neither success nor warning.

### Neutral

- **Open Sky Canvas** (#F8FAFC light / #090D16 dark): Screen background.
- **Ledger Surface** (#FFFFFF light / #111827 dark): Cards, sheets, fields, and navigation surfaces.
- **Registry Layer** (#F1F5F9 light / #1F2937 dark): Grouped sections, inactive controls, and subtle selected regions.
- **Working Outline** (#CBD5E1 light / #374151 dark): One-pixel boundaries and dividers.
- **Quiet Control Outline** (#F3F4F6 light / #1E293B dark): Resting borders for cards, search fields, and filter chips. It keeps repeated controls defined without creating a grid of dark outlines.
- **Primary Ink** (#1E293B light / #F8FAFC dark): Titles and essential values.
- **Secondary Ink** (#475569 light / #CBD5E1 dark): Body copy, metadata, and supporting labels.
- **Muted Ink** (#64748B light / #9CA3AF dark): Hints and nonessential metadata; never use for critical information.

### Named Rules

**The Green Earns Attention Rule.** Green should occupy roughly 10–15% of a screen. Use it for the current selection, the primary action, or a meaningful state—not decorative blocks.

**The Status Has a Domain Rule.** Color and copy must distinguish service progress, reproductive outcome, farmer observation, technician review, official pregnancy diagnosis, continuation recheck, and diagnostic follow-up. Never collapse them into a vague “Status.”

**The Token-Only Rule.** Screen and component code must not introduce raw hex values. Add or reuse a semantic token in the shared theme.

## 3. Typography

**Display Font:** Outfit (with the platform sans-serif as fallback)
**Body Font:** Outfit (with the platform sans-serif as fallback)
**Label/Mono Font:** Outfit; use tabular numerals where the platform supports them for dates, counts, and identifiers.

**Character:** Outfit feels contemporary without becoming ornamental. Strong weight changes—not oversized type, extreme tracking, or all-caps labels—create the hierarchy.

### Hierarchy

- **Headline** (800, 24px, 30px): Top-level screen titles and the most important empty-state title.
- **Title** (700, 18px, 24px): Card headings, section headings, and detail-page subject names.
- **Body Strong** (600, 14px, 20px): Buttons, important values, row titles, and compact subheadings.
- **Body** (400, 14px, 20px): Descriptions, field values, and supporting copy.
- **Label** (600, 12px, 16px, sentence case): Field labels, metadata headings, tabs, and status text.
- **Caption** (400, 12px, 16px): Timestamps and optional secondary metadata.

### Weight Guardrails

- **800 is reserved for Headline.** Do not use ExtraBold to make card content, values, or section headings feel important.
- **700 is reserved for Title.** Use Bold for page subjects and section hierarchy, not ordinary row content.
- **600 carries emphasis.** Use Semibold for actions, row titles, important values, and labels.
- **400 carries reading.** Use Regular for descriptions, field values, timestamps, and metadata.
- **500 and 900 are not semantic product roles.** Existing uses are migration debt; do not add new Medium or Black text to application screens.

### Named Rules

**The Twelve-Pixel Floor Rule.** No meaningful text may render below 12px. If content does not fit, improve the layout or copy instead of shrinking it.

**The Sentence-Case Rule.** Use sentence case for navigation, actions, labels, and statuses. Uppercase is reserved for genuinely established short codes.

**The Two-Weight Rule.** A card should normally use only regular and semibold or semibold and bold. Extra weight changes create noise rather than hierarchy.

**The Semantic Text Rule.** Application screens must use the shared `Text` component's `textRole` values—`headline`, `title`, `bodyStrong`, `body`, `label`, and `caption`. Do not introduce screen-local `fontFamily`, `fontSize`, `fontWeight`, or `lineHeight` values when a semantic role fits.

**The Dynamic Type Rule.** Important text must remain readable with enlarged system text. Let rows grow or reflow; do not force decision-relevant names, statuses, identifiers, or actions into undersized one-line containers.

## 4. Elevation

The Field Ledger is flat by default. Depth comes from canvas-to-surface contrast and a one-pixel Working Outline; low elevation is reserved for sticky navigation, floating controls, and transient overlays. Light and dark modes use the same hierarchy, not inverted decoration.

### Shadow Vocabulary

- **Raised Control** (`0 2px 6px rgba(15, 23, 42, 0.08)`): Sticky bottom navigation or a control that must remain visually above scrolling content; Android elevation 2.
- **Modal Overlay** (`0 8px 24px rgba(15, 23, 42, 0.16)`): Dialogs and bottom sheets only; Android elevation 6.

### Named Rules

**The Flat-by-Default Rule.** Resting cards and list rows use a tonal surface plus a one-pixel outline, not a shadow.

**The One Depth Cue Rule.** Do not combine a prominent border and a wide shadow on the same surface.

## 5. Components

### Buttons

- **Character:** Tactile and confident, with a clear action hierarchy.
- **Shape:** Rounded rectangle using the medium radius (12px), never a capsule for standard actions.
- **Primary:** Field Green background, white text, 16px horizontal padding, and a 48px minimum height.
- **Secondary:** Ledger Surface background, Field Green text, and a one-pixel Working Outline.
- **Ghost:** Transparent background with Primary or Secondary Ink; use for low-emphasis actions such as Cancel.
- **Destructive:** Action Red background for the final destructive confirmation only.
- **Pressed / Focus:** Darken or tint the surface without changing geometry. Show a visible two-pixel focus treatment for keyboard or switch input.
- **Disabled:** Preserve the label, reduce contrast, and block interaction; never communicate disabled state through opacity alone when the reason can be explained.

### Chips

- **Style:** Chips are one of the few full-pill components. Keep them compact but provide a 44px touch target.
- **Surface:** Use Ledger Surface with the one-pixel Quiet Control Outline. Do not give resting or selected chips a darker Working Outline.
- **State:** Unselected chips use Secondary Ink. Selected chips use Field Wash and Field Green; selection is communicated by tint and text rather than a stronger border.
- **Use:** Filters, compact status tags, and short categories only. Do not use a chip for a primary action.

### Cards / Containers

- **Corner Style:** Large radius (16px).
- **Background:** Ledger Surface over Open Sky Canvas.
- **Shadow Strategy:** Flat at rest; see Elevation.
- **Border:** One-pixel Working Outline when the surface edge needs definition.
- **Internal Padding:** 16px standard; 12px only for dense, repeated rows.
- **Structure:** Title and status occupy the first row. Group related metadata beneath with 8–12px gaps. Place full-width actions at the bottom with 16px separation.
- **Rule:** Use a card only for a distinct object or actionable group. Do not nest cards.

### Inputs / Fields

- **Style:** Ledger Surface, one-pixel Working Outline, medium radius (12px), and 48px minimum height.
- **Search fields:** Use the same Ledger Surface and Quiet Control Outline as resting cards (`gray-100` in light mode and `slate-800` in dark mode), with a restrained small shadow. Change only the outline to Field Green while focused.
- **Focus:** Change the outline to Field Green and add a restrained two-pixel focus ring.
- **Error:** Use Action Red for the outline and error message; keep the entered value readable.
- **Disabled / Read-only:** Use Registry Layer and Secondary Ink. Clearly label read-only information instead of styling it like an editable control.
- **Data absence:** Omit optional rows when no value exists. For required or decision-relevant data, show “Not recorded” with a short explanation or next action—never raw “N/A.”

### Navigation

- **Top app bar:** Top-level destinations show a 24px headline. Detail and form routes show a visible back action with a 48px touch target and a concise title.
- **Bottom navigation:** Use at most five top-level destinations. Each item has a 48px touch target and a 38–40px active icon container that remains circular in every state.
- **Active state:** Field Wash with Field Green in light mode; Deep Grove with Bright Field Green in dark mode. The active shape must not change from round to square on press.
- **Role treatment:** Keep placement and interaction consistent across roles, while labels and destinations reflect each role’s work.
- **Large screens:** At expanded widths, allow a side rail or wider content frame instead of stretching phone cards edge to edge.

### Status Badge

- **Shape:** Full pill with 8px vertical and 12px horizontal padding.
- **Content:** Human-readable sentence-case label paired with an icon only when the icon adds meaning.
- **Semantics:** Pair color with text; color alone must never carry status.
- **Copy:** Translate backend enums and error codes before rendering. Never display test-seed prefixes.

### Record and Request Rows

- **Structure:** Show the animal or request subject first, then the service type, date, responsible role, and domain-specific state.
- **Identifiers:** Display an ID once per row or card. Secondary identifiers belong in the detail page.
- **Duplication:** Deduplicate by canonical record or request identifier before presentation; do not hide legitimate linked attempts or continuation rechecks.
- **Actions:** The whole row may open details. Keep destructive or workflow-changing actions explicit and separately labeled.

### Async and Offline States

- **Loading:** Use stable skeletons matching the final layout; avoid spinners that replace an entire usable screen.
- **Empty:** State what is absent and offer one relevant next action when permitted.
- **Error:** Explain what failed in plain language and provide retry when safe.
- **Offline:** Preserve queued actions and show synchronization state without exposing backend codes.

## 6. Do's and Don'ts

### Do:

- **Do** use the 4px spacing grid and prefer 8px, 12px, 16px, 24px, and 32px for repeated layout rhythm.
- **Do** use 16px horizontal screen gutters on compact phones and 24px on wider phones or tablets.
- **Do** cap readable tablet content instead of stretching every card across the viewport.
- **Do** keep interactive targets at least 48px high for the shared Android/iOS implementation.
- **Do** support safe areas, dynamic text growth, keyboard avoidance, screen readers, switch input, and reduced motion.
- **Do** pair every status color with human-readable text and preserve the product’s domain terminology.
- **Do** use shared components for headers, status badges, detail rows, async states, layout wrappers, buttons, cards, fields, and chips.
- **Do** prefer Lucide icons for application actions and navigation. Use a second icon source only for a missing livestock-specific pictogram, and document the exception.
- **Do** keep transitions functional and brief: about 120ms for pressed feedback and 180–220ms for state or sheet transitions.
- **Do** verify every shared primitive in light mode, dark mode, compact phones, and tablet widths.

### Don't:

- **Don't** use marketing-page layouts.
- **Don't** use excessive animation or motion-heavy dashboard layouts.
- **Don't** use decorative bento grids.
- **Don't** use glassmorphism.
- **Don't** use oversized empty hero sections.
- **Don't** show unclear generic statuses.
- **Don't** create page-specific copies of an existing shared component.
- **Don't** add a new design system or UI library; improve the existing React Native primitives and theme.
- **Don't** use raw enum values, backend error codes, test-seed prefixes, or unexplained “N/A.”
- **Don't** use raw hex colors, arbitrary spacing, or one-off radii inside screen files.
- **Don't** use 24–32px corner radii for ordinary cards; reserve the full pill for chips, statuses, and circular controls.
- **Don't** place a standard action button in the visual center of a card. Anchor actions after content with at least 16px of separation and bottom padding.
- **Don't** nest cards, stack multiple outlines, or combine a strong border with a wide shadow.
- **Don't** shrink labels below 12px to make dense content fit.
- **Don't** rely on color, icon shape, or opacity alone to communicate state.
- **Don't** duplicate a record or request identifier in the same list item or card.
