# Bilingual EvalHub-style README design

## Goal

Make Chinese the default visitor experience and add an equally complete English version, using
EvalHub's centered, product-led README rhythm without changing product behavior or media assets.

## Files

- `README.md`: Chinese primary version shown by GitHub.
- `README_EN.md`: complete English version.
- Both files use a prominent centered `简体中文 · English` language switch.

## Shared layout

Both versions follow the same section order:

1. Centered project name, memorable value proposition, language switch, verified badges, and
   anchor navigation.
2. Short visitor-facing introduction followed by the existing home screenshot and a caption.
3. Four-row capability table covering knowledge bases, Agents, MCP tools, and self-hosted control.
4. Quick Start before implementation detail.
5. EvalHub-style two-column screenshot gallery, with the deployment image kept full-width in the
   deployment section.
6. One Mermaid overview, compact technology table, current scope, documentation, and contributing.

## Positioning

Chinese headline: `把知识库、Agent 与 MCP 工具放进一套可自托管工作流。`

The copy must remain factual: Spring Boot + Next.js + LangChain4j, SSE streaming, connections to
manually configured MCP gateways/tool containers, external infrastructure requirements, no complete
tool-import workflow in the current UI, and no public demo or one-click public deployment.

## Media contract

Each version must retain all six URLs exactly once:

- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050014.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050110.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050206.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050242.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050349.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222051116.png`

## Validation

- Compare exact media URL counts in both language files.
- Verify language switches, anchor links, relative documentation links, and balanced fences.
- Confirm the two versions have matching major-section order and equivalent meaning.
- Run `git diff --check` and inspect the full branch diff for unsupported product claims.

## Acceptance criteria

The Chinese root README should visually read as a sibling of EvalHub: centered identity, compact
navigation, immediate product proof, capability table, Quick Start, paired screenshots, and a
single architecture explanation. English must be one obvious click away and equally complete.
