# Taste
- When extending the project with new content or features, prefers following the existing established pattern/structure (e.g. reusing the same YAML/component conventions) rather than inventing a new approach. Confidence: 0.5
- When changing behavior or restructuring a project, prefers deleting redundant/dead code (unused components, layers, branches, styles) rather than leaving it in place for minimal diff. Confidence: 0.6
- When mapping a ticket's service area, expects the full validity extent to be covered (including secondary/rail-only extensions beyond the primary boundary) instead of being left as a documented gap or draft note. Confidence: 0.5
- Wants map markers to degrade progressively as the user zooms out: full label + icon at high zoom, icon only at mid zoom, and fully hidden at low zoom. Confidence: 0.55
- Prefers UI built from @material/web's existing components and design tokens instead of hardcoded values (hex colors, raw font stacks, fixed sizes); wants existing hardcoded CSS progressively tokenized. Confidence: 0.7
- Wants app icons to reproduce the operator's official app icon (real branding) rather than a neutral, trademark-avoiding placeholder. Confidence: 0.65
- Wants a ticket/app service area defined by the network's actual operational reach (the locations of every bus stop and rail station it serves) rather than by an administrative boundary. Confidence: 0.65
