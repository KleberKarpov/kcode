---
name: prd-next
description: Generate the next version of a PRD (Product Requirements Document) by scanning the project for existing PRDs, finding the latest version, comparing it against the real codebase, and producing an updated Markdown PRD with a clear list of pending items. Use when the user asks to update a PRD, generate a new PRD version, audit project completion, list pending features, or reconcile documentation with actual implementation.
---

# PRD Next

Skill for finding, auditing, and updating PRDs against the real codebase, producing a new version with clear pending-item tracking.

## Core Workflow

### Step 1 — Find Existing PRDs

1. Search the project for any existing PRD documents:
   ```bash
   # Common PRD filenames
   find . -iname "*prd*" -o -iname "*requirements*" -o -iname "*product*doc*" | grep -iE '\.(md|txt|pdf|docx)$'
   ```
2. Also search inside common directories:
   ```bash
   find . -type d -maxdepth 3 | grep -iE 'docs|doc|docs/|documentation|specs'
   ```
3. If no PRD is found, tell the user and offer to create one from scratch using the same workflow (Steps 2–5) but starting with the codebase.

### Step 2 — Identify the Latest Version

1. Read every PRD file found in Step 1.
2. Determine which is the most recent by:
   - Looking for version markers (e.g. `v1.2`, `Version 2`, `## Changelog`)
   - File modification dates
   - Explicit date headers inside the document
3. Select the latest version as **base document**. If conflicting, show the user the candidates and let them pick.

### Step 3 — Scan the Real Codebase

Before generating the new PRD, gather what **actually exists** in the project.

#### 3a. Project Structure
```bash
find . -maxdepth 4 -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' | head -300
```

#### 3b. Technology Stack
- Read `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, or equivalent.
- Read config files: `tsconfig.json`, `tailwind.config.*`, `next.config.*`, `vite.config.*`, `Dockerfile`, `docker-compose.yml`.

#### 3c. Routes & Pages
- **Next.js**: scan `app/` and `pages/` directories.
- **React/Vite**: check router definitions in `src/`, `routes/`.
- **Other**: adapt based on framework detected.

#### 3d. API Endpoints
- Search for route definitions, controllers, handlers:
  ```bash
  grep -riE 'route\.|app\.(get|post|put|delete|patch)|router\.(get|post)|@app\.route|@router\.' --include='*.ts' --include='*.js' --include='*.py' --include='*.go' | head -80
  ```

#### 3e. Database Schema
- Read `prisma/schema.prisma`, `migrations/`, SQL files, or ORM models.
- If using Supabase/Firebase, check for relevant config or `supabase/migrations/`.

#### 3f. Auth & Integrations
- Search for OAuth, auth providers, third-party SDKs:
  ```bash
  grep -riE 'supabase|firebase|auth0|clerk|next.auth|oauth|stripe|sendgrid|aws-sdk|openai' --include='*.ts' --include='*.js' --include='*.py' --include='*.json' | head -40
  ```

#### 3g. Key Components & Features
- List major components, services, hooks, contexts.
- Check for UI feature flags, configuration toggles.

### Step 4 — Compare PRD vs. Reality

Build a comparison matrix:

| PRD Feature / Requirement | Status | Notes |
|---------------------------|--------|-------|
| Feature described in PRD  | ✅ Done / 🔄 In Progress / ❌ Missing / ⚠️ Partial | Evidence from code |

For each requirement listed in the base PRD:
- **✅ Done**: Implementation exists and is complete (reference files/lines)
- **🔄 In Progress**: Partial implementation found, clearly incomplete
- **❌ Missing**: No code found matching this requirement
- **⚠️ Partial**: Partially implemented (describe what's missing)

Also identify features in the code that are **not documented** in the PRD (implementation drift).

### Step 5 — Generate the New PRD

Create a new document with the following structure:

```markdown
# [Project Name] — PRD v{next_version}

> Updated: {current_date}
> Previous: v{previous_version} → v{next_version}
> Based on: analysis of codebase vs. previous PRD

---

## 1. Vision & Goals
*(carry over from previous, update if needed based on what's actually built)*

## 2. Target Users & Personas
*(carry over / update)*

## 3. Tech Stack
*(updated from actual codebase scan — list languages, frameworks, libraries, services)*

## 4. Architecture Overview
*(updated to reflect actual architecture found in code)*

## 5. Feature Inventory

### 5.1 Completed Features ✅
*(list each feature with brief description and code reference)*

### 5.2 In Progress 🔄
*(list partial implementations with what remains)*

### 5.3 Pending / Not Started ❌
*(list features from PRD that don't exist in code yet)*

### 5.4 Undocumented Features ⚠️
*(features found in code but not mentioned in PRD — implementation drift)*

## 6. Detailed Feature Specs

For each pending or in-progress feature, include:
- **Name**
- **Description**
- **User story**
- **Acceptance criteria**
- **Dependencies**
- **Estimated complexity** (Low / Medium / High)
- **Suggested next steps**

## 7. Pending Action Items

| # | Action Item | Category | Priority | Status |
|---|-------------|----------|----------|--------|
| 1 | {item} | Feature/Fix/Infra | High/Med/Low | Not Started |

## 8. Database Schema
*(current schema summary based on actual files)*

## 9. API Surface
*(current endpoints/routes summary)*

## 10. Auth & Security
*(current auth flow, providers, security measures found)*

## 11. Deployment & Infrastructure
*(current deployment setup, environments, CI/CD if found)*

## 12. Roadmap & Priorities
*(suggested priority order for pending items)*

---

## Changelog

### v{next_version} — {date}
- Audited against codebase
- {list of changes from previous version}

### v{previous_version} — {previous_date}
- {carry over from previous}
```

### Step 6 — Save and Present

1. Save the new PRD to the appropriate location:
   - If previous PRDs exist in `docs/` → save as `docs/PRD-v{version}.md`
   - If previous PRDs at root → save as `PRD-v{version}.md`
   - Default: project root as `PRD.md`
2. Update any symlink or `PRD-latest.md` pointer if used.
3. Present a summary to the user:
   - Number of features done, in progress, pending
   - Any undocumented features found (drift)
   - Top 3 recommended next actions

## Reference Files

- `references/prd-template.md` — Full PRD template to reference when generating
- `references/checklist.md` — Audit checklist for codebase scanning

## Output Constraints

- Output **always** in Markdown format.
- Version number should auto-increment from the previous version (e.g., v2.3 → v2.4, or v1.2 → v1.3).
- If no previous version exists, start at v1.0.
- Include timestamps for traceability.
- When listing pending items, be specific — reference actual code locations where relevant.
