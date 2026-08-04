# Visitor-first README design

## Goal

Rewrite the root README so a first-time visitor can understand the project, see the product,
and start it locally without reading a long architecture document first.

## Scope

- Keep the README in English.
- Preserve every existing product screenshot URL exactly; captions and placement may change.
- Reorder and shorten existing material. Do not add product features or unsupported claims.
- Keep one useful architecture overview and link to repository documentation for detail.

## Visitor flow

1. Project name, accurate one-sentence positioning, and verified badges.
2. Existing home screenshot as the hero image.
3. Three concise capabilities: knowledge bases, configurable Agents, and MCP tools.
4. Source-based Quick Start with prerequisites and explicit environment requirements.
5. Product gallery using the existing knowledge base, Agent, and provider screenshots.
6. One architecture overview and a compact technology stack.
7. Deployment notes, using the existing deployment screenshot and stating its limitations.
8. Documentation links, current project status, limitations, and contribution guidance.

## Media contract

The following six URLs must remain unchanged and appear exactly once:

- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050014.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050110.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050206.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050349.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222050242.png`
- `https://raw.githubusercontent.com/NEDONION/my-pics-space/main/20251222051116.png`

## Accuracy rules

- Describe the project as a self-hosted Spring Boot, Next.js, and LangChain4j application.
- Do not claim production readiness, high availability, complete multi-tenancy, AES-256 secret
  storage, rate limiting, or one-click Docker Compose deployment.
- Present SSE as the current streaming path and GitHub/ZIP as the supported tool sources.
- Do not show demo credentials unless a working public demo URL exists.
- Only use badges that are supported by repository files; do not add a license or CI badge.

## Validation

- Compare the six media URLs before and after the rewrite.
- Check all relative README links resolve in the repository.
- Check fenced code blocks and Markdown anchors render correctly.
- Run `git diff --check` and inspect the final README diff for unsupported claims.

## Acceptance criteria

A visitor should understand the product and reach a working source-based Quick Start within the
first few sections. All six original screenshots remain present with unchanged URLs, while stale
claims and repeated architecture material are removed.
