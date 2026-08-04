# Visitor-first README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root README with a concise, accurate visitor-first project page while preserving all six existing screenshots.

**Architecture:** This is a documentation-only rewrite of `README.md`. Product detail stays in existing repository docs; the root page becomes a guided path from positioning and product proof to Quick Start, architecture, and limitations.

**Tech Stack:** GitHub-flavored Markdown, Mermaid, shell validation

## Global Constraints

- Keep all six screenshot URLs exactly unchanged and present once.
- Use only repository-supported product claims, commands, versions, and badges.
- Do not add dependencies, generated media, or new runtime behavior.

---

### Task 1: Rewrite the visitor-facing README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-05-readme-visitor-first-design.md`
- Produces: A standalone GitHub landing page with preserved media and a source-based Quick Start.

- [x] **Step 1: Capture the current media contract**

Run: `rg -o 'https://raw.githubusercontent.com/NEDONION/my-pics-space/main/[0-9]+\.png' README.md | sort -u`

Expected: the six URLs listed in the design spec.

- [x] **Step 2: Replace the README content**

Use the spec section order. Keep the home screenshot as hero, move product screenshots into a gallery, retain one Mermaid architecture overview, and place deployment detail after Quick Start.

- [x] **Step 3: Check the rendered-document structure**

Run: `rg -n '^#|^```|raw.githubusercontent.com|localhost:' README.md`

Expected: one H1, balanced fences, six screenshot references, and the documented local ports.

- [x] **Step 4: Validate media and relative links**

Run: `test "$(rg -o 'https://raw.githubusercontent.com/NEDONION/my-pics-space/main/[0-9]+\.png' README.md | sort -u | wc -l | tr -d ' ')" = 6`

Expected: exit code 0.

- [x] **Step 5: Validate the diff**

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 6: Review and commit**

Run: `git diff -- README.md`

Expected: only the visitor-first documentation rewrite with all six media URLs preserved.

```bash
git add README.md docs/superpowers/plans/2026-08-05-readme-visitor-first.md
git commit -m "docs: make README visitor-first"
```
