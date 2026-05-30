# Moneyprinter-UI Design System

## Phase 3C

This document is source of truth for next visual redesign of `Moneyprinter-UI`.

It is design documentation only. It does not change runtime behavior, API contracts, backend flow, or current implementation structure in `src/App.tsx`, `src/api.ts`, `src/styles.css`, or the partials under `src/styles/**`.

## 1. Purpose and Scope

Phase 3C defines visual system, layout model, interaction rules, and redesign acceptance targets for Phase 3D.

Scope of this document:

- Define visual direction for future UI redesign.
- Preserve current MoneyPrinterTurbo frontend behavior as hard constraint.
- Give another agent enough structure to redesign `src/App.tsx` and the current CSS entrypoint/partials later without guessing.
- Keep current API-connected workflow intact.

Out of scope for this phase:

- Runtime code changes.
- Backend API changes.
- Refactor of current large `src/App.tsx`.
- New product features.
- Marketing site build.

## 2. Design North Star

### Runway soul, Raycast bones

Moneyprinter-UI should evolve into **Cinematic Command Studio**.

That means:

- **Runway soul**: dark, visual, creator-first, cinematic, media-led, polished preview surfaces, strong hierarchy around making video.
- **Raycast bones**: compact structure, command-center clarity, fast scanning, dense but readable controls, keyboard-friendly layout, crisp information architecture.

Target feel:

- Serious creator tool, not cheerful SaaS dashboard.
- Focused studio for generating short-form video, not general productivity workspace.
- Dense enough for repeat use, but never cramped or opaque.
- High contrast, low noise, deliberate motion, visible system status.

This is **inspired by** those products' pattern language. It must not copy brand assets, trademarks, or exact UI compositions.

## 3. Current UI Gap

Current frontend is functional, but visual direction is mismatched with product ambition.

Known current state:

- `src/styles.css` is now the styling entrypoint, importing the split baseline under `src/styles/**`.
- `src/App.tsx` presents app as multi-page creator tool with dashboard, studio, tasks, assets, and settings.
- `src/api.ts` already supports real backend operations and same-origin dev proxy behavior.
- `README.md` documents current app as API-connected React + Vite frontend for MoneyPrinterTurbo.

Gap to close in Phase 3D:

- Current look still needs the split CSS baseline refined into the final cinematic system.
- Future look must feel dark, cinematic, precise, and production-oriented.
- Current layout reads like stacked product cards.
- Future layout should read like studio workspace with command surfaces, preview focus, and queue visibility.

Hard truth for redesign planning:

Current UI does **not** already fully satisfy the dark cinematic creator-studio design. Phase 3D must finish that shift on purpose while building on the split CSS baseline.

## 3.1 Hard Constraints Summary

- Preserve all existing MoneyPrinterTurbo-connected flows and endpoint usage.
- Keep `src/styles.css` as the import entrypoint for the styling system.
- Treat `src/styles/**` as the current styling baseline for future work, not a separate redesign target.
- Do not add new product features while implementing the visual redesign.
- Do not change backend contracts, task lifecycle behavior, or data model assumptions.

## 4. Inspiration Mapping by Area

Use inspiration as directional language only.

Primary external reference collection:

- Repository: <https://github.com/VoltAgent/awesome-design-md>
- Purpose: read the actual `DESIGN.md` files before Phase 3D implementation, then translate their patterns into Moneyprinter-UI's own system.
- Rule: do not copy any brand wholesale; extract reusable design language such as surface hierarchy, density, typography feel, component treatment, motion restraint, and do/don't rules.

Reference files to inspect before redesign:

| Reference | Use for | URL |
| --- | --- | --- |
| Runway | Create Studio, video preview, output gallery, cinematic media-first surfaces | <https://getdesign.md/runwayml/design-md> |
| Raycast | Sidebar, top bar, command-center shell, backend status, settings, compact operational UI | <https://getdesign.md/raycast/design-md> |
| Linear | Task queue clarity, dense rows, issue/status readability, progress scanning | <https://getdesign.md/linear.app/design-md> |
| ElevenLabs | Voice/TTS panel accents, audio-minded controls, waveform-style details | <https://getdesign.md/elevenlabs/design-md> |
| Framer | Future landing/showcase page only, not core app workflow | <https://getdesign.md/framer/design-md> |

Phase 3D implementation must start by reading at least Runway and Raycast references directly. Read ElevenLabs only if redesign touches voice/TTS controls, Linear if task queue is redesigned deeply, and Framer only for future landing/showcase work.

| Area | Primary direction | Notes |
| --- | --- | --- |
| Dashboard | Raycast + Runway | Fast scan, strong status clarity, compact cards, cinematic previews where useful |
| Create Studio | Runway | Main creative surface, dark composition, preview-first workflow, serious media-tool tone |
| Script editor | Raycast | Sharp text container, command utility feel, low chrome, focus on input speed |
| Voice/TTS panel | ElevenLabs accent only | Voice sophistication, waveform or audio-minded cues in restrained form, not full brand mimicry |
| Task queue | Raycast/Linear-like clarity | Dense rows, explicit progress, readable status, no decorative clutter |
| Output gallery | Runway | Large thumbnail confidence, showcase-quality preview framing, clear actions |
| Settings | Raycast | Utility-first, compact sections, low ornament, high legibility |
| Landing/showcase | Framer + Runway later only | Future marketing/showcase surface, not priority for app shell redesign |

Priority order for Phase 3D implementation:

1. Create Studio
2. Dashboard
3. Task queue
4. Output gallery
5. Settings
6. Landing/showcase, later only

## 5. Visual Tokens

Future token system should move from warm light SaaS toward dark OLED-friendly studio UI.

### Color system

- **Canvas**: near-black, cool-neutral foundation.
- **Surface**: layered charcoal panels with small step differences.
- **Elevated surface**: slightly brighter than base panel, never light gray.
- **Text primary**: soft white, not pure white glare.
- **Text secondary**: muted slate-gray with strong readability.
- **Accent primary**: electric blue-cyan for active controls, key actions, focus, and progress.
- **Accent secondary**: restrained violet or indigo accent allowed in tiny doses only.
- **Cinematic accent**: deep red-orange reserved for render energy, warnings, or active media moments.

### Typography

- Use clean neo-grotesk or system-safe sans stack.
- Headings should feel controlled, not playful.
- UI density should favor medium weight labels and compact body copy.
- Avoid oversized hero typography inside app shell.

Recommended tone:

- Headings: strong, compact, utility-driven.
- Body: readable, neutral, low-drama.
- Labels: crisp, sentence case preferred.
- Numbers and status: tabular or stable-width feel where possible.

### Radius

- Main panels: medium radius.
- Inputs and controls: smaller radius than current UI.
- Preview surfaces: medium to large radius, but never bubbly.
- Pills and badges: compact capsule or tight rounded rectangle.

### Borders

- Prefer visible low-contrast strokes over fuzzy light glass edges.
- Border color should separate surfaces clearly in dark mode.
- Use inner separators for dense data regions.

### Spacing

- Tighter than current app.
- More command-center density in nav, forms, queue, and settings.
- Keep breathing room around preview and output surfaces.

### Motion

- Fast, restrained, confidence-building.
- Fade, slide, and opacity shifts only where they clarify state.
- No floaty marketing motion.
- No hover transforms that shift layout.

### Status colors

- Online / healthy: green with readable dark-background contrast.
- Processing: blue-cyan.
- Warning: amber.
- Failed / error: red.
- Idle / muted: slate.

### CSS Token Example

```css
:root {
  color-scheme: dark;

  --bg-canvas: #07090d;
  --bg-canvas-alt: #0b0f14;
  --bg-surface-1: #10161d;
  --bg-surface-2: #151c24;
  --bg-surface-3: #1b2430;

  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);

  --text-primary: #f5f7fb;
  --text-secondary: #a4b0c0;
  --text-muted: #7b8797;

  --accent-primary: #58a6ff;
  --accent-primary-hover: #79b8ff;
  --accent-secondary: #8b7dff;
  --accent-cinematic: #ff6b4a;

  --status-success: #31c36c;
  --status-warning: #ffb547;
  --status-danger: #ff5d5d;
  --status-info: #58a6ff;

  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;

  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --shadow-panel: 0 12px 32px rgba(0, 0, 0, 0.32);
  --shadow-overlay: 0 24px 80px rgba(0, 0, 0, 0.45);

  --motion-fast: 140ms ease;
  --motion-base: 220ms ease;
}
```

## 6. Layout Architecture

Future app shell should use stable studio layout across major pages.

### Primary regions

- **Top bar**: global title, page context, backend status pulse, quick actions, future command entry.
- **Compact sidebar**: page switching, icon-first with labels visible at desktop, collapsible behavior on smaller widths.
- **Main studio workspace**: primary content surface for dashboard cards, script workflow, previews, and outputs.
- **Inspector/settings rail**: contextual controls, parameters, task metadata, render settings, API details.
- **Bottom task strip**: persistent queue visibility, running task states, quick open into task detail.

### ASCII layout diagram

```text
+-----------------------------------------------------------------------------------+
| Top Bar: page title | backend status | search/command slot | quick actions        |
+----------------------+------------------------------------------------------------+
| Compact Sidebar      | Main Studio Workspace                     | Inspector Rail |
|                      |                                            |                |
| Dashboard            |  Active page content                       | Contextual     |
| Create Studio        |  - Script / assets / preview               | controls, API  |
| Tasks                |  - Gallery / dashboard / settings body     | details, task  |
| Assets               |                                            | params         |
| Settings             |                                            |                |
+----------------------+--------------------------------------------+----------------+
| Bottom Task Strip: queue, progress, errors, completed outputs, quick jump         |
+-----------------------------------------------------------------------------------+
```

### Layout behavior notes

- Create Studio should treat preview and controls as twin pillars.
- Dashboard should summarize live system state without feeling like analytics software.
- Tasks should remain readable in dense horizontal or stacked card forms.
- Settings should inherit same shell, not become separate flat document page.

## 7. Workflow Model

Core workflow remains unchanged and must stay visible in redesign:

**Topic -> Script -> Assets -> Voice -> Subtitle -> Render -> Preview -> Export**

Design implications:

- Workflow should be understandable at first glance.
- Current flow should remain mapped to existing API behavior in `src/api.ts`.
- Each step should expose dependencies clearly.
- User should always know current stage, next action, and failure point.
- Queue and preview state should remain visible during processing.

Behavior constraint:

Redesign must preserve current API sequence already reflected in `README.md` and current UI behavior:

1. Enter subject.
2. Generate script.
3. Generate terms.
4. Submit video render.
5. Poll task status.
6. Preview `/tasks/...` outputs.

Visual restructuring is allowed. API semantics are not.

## 8. Component Rules

### API status

- Keep status visible in top bar and settings context.
- States must remain explicit: checking, online, offline.
- Never hide connection health behind decorative icon only.
- Show backend target clearly, including same-origin dev proxy state when relevant.

### Task queue

- Dense, scannable, row-based or strip-based.
- Must expose task ID, subject, status, progress, updated time, and output availability.
- Running tasks should feel alive without noisy animation.
- Failed tasks must show error state clearly.

### Script editor

- Monospaced or near-editor feel is acceptable, if readability stays high.
- Keep editing focus strong.
- Secondary actions like generate, refine, and copy should stay nearby.
- Avoid oversized marketing-card framing.

### Video preview

- Treat as premium surface.
- Strong frame, dark surround, minimal chrome.
- Output links and preview actions should be obvious.
- Preview area should not collapse into tiny afterthought on desktop.

### Output gallery

- Use large thumbnail-led cards or compact cinematic tiles.
- Make completed outputs feel tangible and worth reviewing.
- Keep metadata and actions readable.
- Separate combined videos from individual outputs clearly.

### Forms and controls

- Use compact labeled groups.
- Labels must stay visible, not placeholder-only.
- Sliders, selects, switches, and numeric inputs should align to utility-tool expectations.
- Preserve all current control meaning and backend parameters.

### Notifications and errors

- Use inline contextual feedback first.
- Toasts may support confirmation, but cannot be sole error surface.
- Error copy should say what failed and what user can try next.
- Timeouts, offline state, and failed tasks must be obvious.

### Empty states

- Calm, purposeful, brief.
- Tell user what to do next.
- Avoid cute illustrations or novelty language.
- Empty output gallery should still reinforce creator-studio identity.

## 9. Accessibility and QA Checklist

Every Phase 3D design pass must meet this baseline:

- Visible `:focus-visible` treatment on all interactive controls.
- Full keyboard navigation across nav, forms, queue, tabs, dialogs, and preview actions.
- Semantic controls, use button for actions, label for fields, proper heading order.
- Explicit labels for all form inputs.
- Text and UI contrast must hold on dark surfaces.
- Reduced motion support for transitions and status activity.
- Responsive checks at `375`, `768`, `1024`, and `1440` widths.
- No horizontal scroll on standard page content.
- Icons from SVG-based system such as Lucide, not emojis.
- Hover states must not cause layout shift.

Recommended QA pass for redesign:

1. Keyboard-only navigation across full create flow.
2. API offline simulation.
3. Long script content in editor.
4. Multiple task cards with mixed states.
5. Output gallery with no results, one result, and many results.
6. Mobile and tablet shell collapse behavior.

## 10. Anti-Patterns

Do not drift into these directions:

- No generic purple AI gradients.
- No fintech or crypto dashboard feel.
- No Notion-like document workspace.
- No luxury product showcase excess.
- No Streamlit-like vertical form clone.
- No hiding important controls for aesthetics.
- No soft beige wellness SaaS look.
- No giant empty hero sections inside app shell.
- No decorative glass overload that hurts readability.
- No dependency on exact external-brand mimicry.

## 11. Implementation Sequencing

Order of work after this document:

1. **Docs now**: finalize this design-system plan as source of truth.
2. **Visual redesign v1 next**: restyle app shell and major page sections in frontend only.
3. **Backend QA later**: verify current API-connected behaviors still work after redesign.
4. **Refactor after behavior stabilizes**: consider splitting `src/App.tsx` only after redesigned behavior and layout are settled.

Important sequencing rule:

Do not use design cleanup as excuse to refactor current app structure before visual behavior is stable. Current large `src/App.tsx` is known, but not Phase 3C target.

## 12. Acceptance Criteria for Phase 3D Redesign

Phase 3D is complete only if all points below are true:

- App reads as dark cinematic creator studio, not light warm SaaS.
- Shell reflects top bar, compact sidebar, main workspace, inspector rail, and bottom task strip pattern, or a responsive equivalent grounded in same architecture.
- Create Studio becomes redesign centerpiece.
- Dashboard, task queue, output gallery, and settings align with same visual language.
- All current backend flows from `src/api.ts` remain intact.
- Same-origin dev proxy and direct backend URL behavior remain intact.
- Existing page coverage from `src/App.tsx` remains intact.
- Output preview for `/tasks/...` results remains intact.
- Accessibility baseline from this document passes.
- No anti-patterns from this document appear in final UI.
- Another engineer can inspect final result and trace clear alignment to this document.

## Hard Constraint Summary

Future redesign may change layout, styling, density, and component presentation.

It must **not** break or redefine current API behavior documented by current implementation:

- `src/App.tsx` remains current source of page behavior until later refactor.
- `src/styles.css` is current styling entrypoint, with `src/styles/**` as baseline partials to refine visually, not behaviorally.
- `src/api.ts` remains behavioral contract for frontend-backend communication.
- `README.md` remains current scope reference for what frontend already does.

Phase 3C outcome is clear direction, not code. Phase 3D should execute this direction with discipline.
