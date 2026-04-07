## Repo to Prompt

Turn a local codebase into a structured, LLM‑ready prompt with file‑level context and a focused dependency flow graph.

### Features

- **Prompt sizes**
  - **Low (Structural)** – file tree and entry points only.
  - **Medium (Contextual)** – Low + per‑file summaries, functions, classes, exports, and React‑style prop types.
  - **High (Comprehensive)** – Medium + full raw source for text files (code, markdown, configs). Binary assets such as images are excluded.
- **Focused file flow**
  - Visualize **upstream**, **downstream**, or **bidirectional** dependencies for a single file.
  - Square, responsive React Flow graph with fullscreen mode.
- **Local‑only analysis**
  - Uses the **File System Access API**; nothing is uploaded to a server.

### Requirements

- Node.js 18+
- A Chromium‑based browser that supports the File System Access API (e.g. Chrome, Edge).

### Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser.

### Production build

```bash
npm run build
npm start
```

### Usage

1. Click **Select Folder** and choose your repo (nothing is uploaded).
2. Use the left file tree to include or exclude files.
3. Click **Analyze Repository** to generate analysis.
4. Choose a **prompt size** and copy the generated prompt into your model.
5. Use **Focused File Flow** to inspect how a specific file is wired into other files.

