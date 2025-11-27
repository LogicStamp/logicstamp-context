# LogicStamp Context

**A fast, zero-config CLI that turns your React/TypeScript codebase into AI‑ready context bundles.**

Generate modular context files, detect context drift, optimize token costs, and keep your AI assistants aligned with your codebase — all with one command.

<div align="center">

```
npm install -g logicstamp-context
```

</div>

---

# 🚀 Why LogicStamp?

Modern AI tools (ChatGPT, Claude, Cursor, VS Code copilots) struggle to understand large codebases without help.

LogicStamp Context gives them the **entire architecture** of your project in a structured, compressed, predictable format.

### **🎯 What LogicStamp does better than everyone else**

* **Modular, folder‑based output** → `context.json` per folder + `context_main.json` index
* **Jest‑style drift detection** → added, removed, changed folders and components
* **Token‑aware generation** → GPT‑4o & Claude token estimates + mode comparison
* **CI‑ready lifecycle** → init → generate → validate → compare → clean
* **Next.js App Router intelligence** → detects `"use client"`, `"use server"`, app directory
* **Rock‑solid validation** → schema checking for every context file
* **Incremental adoption** → no config, no build step, no special framework requirements

All of this in a **5MB package** with zero external dependencies.

---

# 🔥 Quick Start

```bash
# Install globally
npm install -g logicstamp-context

# Generate AI-ready context for your project
stamp context

# Validate everything
stamp context validate

# Detect drift across all folders
stamp context compare

# Clean context artifacts (dry run)
stamp context clean
```

---

# 📦 What LogicStamp Generates

LogicStamp produces a **multi-file, folder-organized** set of context bundles:

```
output/
├── context_main.json
├── context.json
└── src/
    └── context.json
```

### context_main.json

A global index of your project’s structure with:

* All folder metadata
* Component lists
* Token estimates
* Paths to all context files
* Origin framework detection (e.g., Next.js App Router)

### context.json (per folder)

Each folder gets a bundle containing:

* Full UIFContract for each component
* Dependency graph (nodes + edges)
* Semantic hash for drift detection
* Code snippets (none / header / full)
* Behavioral predictions (optional)

---

# ⚛️ Next.js App Router Support

LogicStamp detects:

* `"use client"`
* `"use server"`
* Whether components are in `app/`
* Server vs client boundaries

AI assistants now *understand* your Next.js project.

---

# 🧪 Compare & Drift Detection

### **Multi-file mode (recommended)**

```bash
stamp context compare
```

Detects:

* ➕ **Added folders**
* 🗑️ **Orphaned folders**
* ⚠️ **Drift** in components
* ✓ **PASS** for unchanged files

### Approval workflow

```bash
stamp context compare --approve
```

Updates everything automatically — like `jest -u`.

---

# 🧼 Clean Context Files

```bash
# Preview cleanup (dry run)
stamp context clean

# Actually delete all artifacts
stamp context clean --all --yes
```

Safe by default.

---

# 🛡️ Validation

```bash
stamp context validate
```

Validates:

* All folder context files
* Schema integrity
* Missing fields
* Version mismatches

Perfect for CI.

---

# 💰 Token Cost Optimization

Every context run displays token estimates:

```
📏 Token Estimates (header+style mode):
   GPT-4o-mini: 13,895 tokens
   Claude:      12,351 tokens

   Comparison:
     Raw source        | Header        | Header+style
         22,000        |     12,228     |     13,895

   Full context (code+style): ~39,141 GPT-4o-mini / ~34,792 Claude
```

### Compare modes

```bash
stamp context --compare-modes
```

Shows exact savings for:

* none
* header
* full

---

# ⚙️ Command Reference

## `stamp init`

Initialize LogicStamp in a project:

* Adds `.gitignore` patterns
* Creates `LLM_CONTEXT.md`
* Saves preferences

## `stamp context`

Generate AI-ready bundles.
Supports:

* `--depth`
* `--include-code (none|header|full)`
* `--profile (llm-chat|llm-safe|ci-strict)`
* `--max-nodes`
* `--stats`
* `--dry-run`

## `stamp context validate`

Validate entire project (multi-file) or a single file.

## `stamp context compare`

Detect drift across all folders or between two specific files.

* `--approve`
* `--clean-orphaned`
* `--stats`

## `stamp context clean`

Remove generated context artifacts.

* Safe by default
* Requires `--all --yes` to delete

---

# 🏗️ Profiles

* **llm-chat** (default) — balanced, header-only
* **llm-safe** — smallest output
* **ci-strict** — no code, strict validation, CI-friendly

---

# 🧩 Use Cases

* AI pair programming (ChatGPT, Claude, Cursor)
* Codebase exploration & onboarding
* Snapshot testing for code structure
* CI/CD drift detection
* Documentation & architecture diagrams
* Next.js Server/Client boundary analysis

---

# 🛠️ Contributing

PRs welcome! The tool is designed to be:

* Easy to extend
* Easy to test
* Easy to document

If you add a new feature, run:

```
stamp context
stamp context validate
```

---

# 📄 License

MIT License — same freedom as Bun, React, Vercel tools.

---

# ⭐ If this saved you tokens, debugging time, or sanity — give it a star!

It helps more developers find it and keeps the project alive.
