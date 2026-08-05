# Bilingual EvalHub-style README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a Chinese-first EvalHub-style root README and an equally complete English switch version while preserving all six screenshots.

**Architecture:** `README.md` becomes the Chinese landing page and `README_EN.md` becomes the English counterpart. Both use the same centered identity, anchor navigation, product proof, capability table, Quick Start, gallery, architecture, scope, and docs flow.

**Tech Stack:** GitHub-flavored Markdown, HTML tables, Mermaid, shell validation

## Global Constraints

- `README.md` is Chinese-first; `README_EN.md` is complete English.
- Both files use a prominent centered `简体中文 · English` language switch.
- Each file retains all six existing screenshot URLs exactly once.
- Keep Spring Boot/Next.js/LangChain4j, SSE, manually configured MCP gateway/tool container,
  infrastructure, and deployment claims factual; do not claim a complete tool-import UI.
- Add no dependencies, generated media, or runtime changes.

---

### Task 1: Build and validate both visitor pages

**Files:**
- Modify: `README.md`
- Create: `README_EN.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-05-readme-bilingual-evalhub-style-design.md`
- Produces: reciprocal Chinese and English GitHub landing pages with the same visitor journey.

- [x] **Step 1: Capture the six-image contract**

Run: `rg -o 'https://raw.githubusercontent.com/NEDONION/my-pics-space/main/[0-9]+\.png' README.md | sort -u`

Expected: the six URLs in the design spec.

- [x] **Step 2: Write the Chinese and English pages**

Use the spec's exact order and positioning. Mirror EvalHub's centered `<h1>`, centered tagline,
language switch, badges, anchor navigation, hero caption, capability table, Quick Start, HTML
two-column gallery, single Mermaid overview, scope, docs, and contribution sections.

- [x] **Step 3: Validate both pages**

Run: `rg -n '^## |raw.githubusercontent.com|README_EN.md|README.md|^```' README.md README_EN.md`

Expected: reciprocal language links, matching section order, six media references per file, and balanced fences.

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 4: Commit**

```bash
git add README.md README_EN.md docs/superpowers/plans/2026-08-05-readme-bilingual-evalhub-style.md
git commit -m "docs: add bilingual EvalHub-style README"
```
