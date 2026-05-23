# LocalForge IDE (Alpha)

LocalForge is a custom, local-first AI application builder built as a branded desktop product on top of the **Eclipse Theia** platform. It provides a guided "Lovable-style" workflow to take an idea, generate product blueprints, scaffold a Next.js application, and iteratively build the app using local, private AI models.

## Final Alpha Feature Summary

The LocalForge Alpha vertical slice is now functionally complete, covering the entire end-to-end builder loop:

1. **Forge Conductor**: A project-aware agent tracking the active project phase, health, risks, and human blockers, steering the user to the "Next Best Move."
2. **Forge Scout**: A brainstorming workflow that accepts a raw app idea, generates structured business/technical blueprints, and outputs them into the workspace `/docs`.
3. **Blueprint Project Generator**: A templating system that reads the generated `app-blueprint.md` and safely scaffolds an opinionated Next.js (App Router) codebase inside `/apps/web/`.
4. **Live Preview Webview**: A native panel that seamlessly manages the Next.js dev server lifecycle (auto-installing dependencies if missing) and hosts the live application directly within the IDE via an `iframe`.
5. **Dependency Doctor**: A local "vibe coder" safety net that continually parses the Live Preview terminal logs for common framework errors (e.g. missing package managers or `.env` variables) and offers safe, 1-click auto-fixes.
6. **AI Codegen Loop with Diff Approval**: Users can ask the Local Brain to modify the generated codebase. Instead of raw text output or hidden file manipulation, the IDE presents a safe **Code Diff Approval** UI to inspect the exact create/modify/delete actions before they hit the disk.
7. **Local Brain Provider (llama.cpp) & Auto-Installer**: Secure management of a local AI execution layer. The IDE dynamically recommends a curated `llama.cpp` binary matched to the host's hardware (CUDA vs Metal vs CPU), auto-installs it with `sha256` checksum verification, and routes backend RPC traffic securely without exposing shells.
8. **UI Design System**: All custom panels have been upgraded from raw DOM elements to robust React components styled using a central `@localforge/ui` dark-mode, cyan-accented design language.

## Architecture Summary

LocalForge is an **Electron desktop executable**. It is *not* a hosted webpage.

- **Frontend**: The IDE shell, Monaco editor, and all LocalForge panels (e.g., Preview, Doctor, Scout) are written as React widgets (`@theia/react-widget`) running within the Electron renderer process.
- **Backend Services**: Native Node.js services run in the Electron Main process. These orchestrate OS-level file I/O (managing `.localforge` metadata), process spawning (dependency installs and `llama-server` execution), and HTTP traffic proxying (SSE parsing from `llama.cpp` to the UI).
- **Communication**: Frontend and Backend modules communicate seamlessly via Theia's JSON-RPC over WebSockets, orchestrated through InversifyJS dependency injection.
- **Isolation**: All LocalForge logic is carefully siloed inside the `localforge/` top-level directory, preserving the upstream Theia packages for safe merging and updates.

### Folder / Package Map

```txt
localforge/
├── apps/
│   └── desktop/                 # The actual Theia Electron desktop application
├── packages/
│   ├── app-blueprints/          # Contains Forge Scout, Project Generator, Dependency Doctor, Live Preview, and Forge Conductor services/widgets
│   ├── local-brain/             # Contains AI Provider Registry, llama.cpp Runtime Manager, Downloader, and Chat widgets
│   └── ui/                      # Shared React design system (@localforge/ui)
├── templates/
│   └── nextjs-starter/          # (Future) EJS/Handlebars stubs for advanced project generation
└── README.md
```

## Run / Build / Test Instructions

To build and run the LocalForge desktop application locally:

**1. Install Prerequisites (Linux)**
Ensure you have the required native build dependencies:
```bash
sudo apt-get update
sudo apt-get install -y libxkbfile-dev libsecret-1-dev xvfb
```

**2. Install Node Dependencies**
From the root of the repository:
```bash
npm install
```

**3. Build the Packages and App**
```bash
cd localforge/packages/ui && npm run build
cd ../local-brain && npm run build
cd ../app-blueprints && npm run build
cd ../../apps/desktop && npm run build
```

**4. Start the Application**
If you are in a headless environment (like a sandbox), use `xvfb-run`. Otherwise, start the electron target directly via the CLI:
```bash
cd localforge/apps/desktop
# Headless / CI:
xvfb-run -a <start-command> &
```

## Known Limitations & Technical Debt

1. **Deterministic Codegen Mock**: Because this vertical slice was developed in a sandboxed test environment without access to a high-fidelity local LLM or production OpenAI keys, the `AICodegenService` (Phase 3D) falls back to a deterministic string-match mock (e.g., prompting "dark mode" produces a hardcoded patch). The wiring, prompt generation, and parsing logic is real, but the HTTP endpoint calls the mock provider.
2. **Hardcoded Next.js Scaffold**: The `ProjectGeneratorService` (Phase 3B) writes string-literal Next.js files inline. This is sufficient for an MVP, but tightly couples the backend logic to the framework boilerplate.
3. **Command Execution Lifecycle**: The Live Preview backend (`PreviewServiceImpl`) binds to the Theia application lifecycle to clean up detached background processes, but edge-case process zombies could theoretically occur if the Electron main process is `SIGKILL`'ed instantly without cleanup routines firing.

## Recommended Beta Roadmap

The Alpha establishes that the entire pipeline can execute securely and locally. The **Beta** phase should mature the specific components to handle real-world entropy:

- **Beta Phase 1 — Advanced App Blueprint Templates:** Refactor the `ProjectGeneratorService` to utilize a robust templating engine (like EJS or Handlebars) reading from `localforge/templates/nextjs-starter/` instead of hardcoded strings.
- **Beta Phase 2 — Real Curated llama.cpp Binaries:** Populate the `RuntimeInstallerService` manifests with production GitHub release URLs for `llama.cpp` rather than the `test-fixture` generic zips, enabling actual local inference testing.
- **Beta Phase 3 — Context Vector Indexer:** Add a lightweight local database (SQLite-vss or similar) so the Local Brain can semantically search the entire Next.js codebase, rather than relying on deterministic context gathering in the `CodegenPromptBuilder`.
- **Beta Phase 4 — Provider Hub / Cloud Assist Integration:** Finalize the cloud subscription and BYOK integrations. Added a "LocalForge Account" flow to enable users to use a managed cloud LLM if their local machine struggles to run heavier models. Added BYOK functionality for OpenAI, Anthropic (Claude), and Google (Gemini) cloud providers.