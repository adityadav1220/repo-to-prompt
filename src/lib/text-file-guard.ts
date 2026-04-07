/**
 * Avoid treating binary assets as UTF-8 text — `File.text()` on images/fonts/etc.
 * yields mojibake that pollutes high-detail prompts.
 */

const BINARY_EXTENSIONS = new Set(
  [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".avif",
    ".ico",
    ".bmp",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
    ".jxl",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".pdf",
    ".zip",
    ".gz",
    ".tgz",
    ".tar",
    ".bz2",
    ".xz",
    ".7z",
    ".rar",
    ".wasm",
    ".mp3",
    ".mp4",
    ".m4a",
    ".webm",
    ".mov",
    ".avi",
    ".mkv",
    ".sqlite",
    ".db",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".dat",
    ".dmg",
    ".iso",
    ".jar",
    ".class",
    ".dex",
    ".pyc",
    ".pyo",
    ".o",
    ".a",
    ".lib"
  ].map((e) => e.toLowerCase())
)

export function codeFenceLanguage(filePath: string): string {
  const ext = fileExtension(filePath)
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".mts": "typescript",
    ".cts": "typescript",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".json": "json",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".html": "html",
    ".htm": "html",
    ".md": "markdown",
    ".mdx": "mdx",
    ".vue": "vue",
    ".svelte": "svelte",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".rb": "ruby",
    ".php": "php",
    ".sql": "sql",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".svg": "svg"
  }
  return map[ext] ?? "text"
}

function fileExtension(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath
  const i = base.lastIndexOf(".")
  if (i <= 0) return ""
  return base.slice(i).toLowerCase()
}

export function isLikelyBinaryFile(filePath: string, content: string): boolean {
  const ext = fileExtension(filePath)
  if (ext && BINARY_EXTENSIONS.has(ext)) return true

  const sample = content.slice(0, 8192)
  if (sample.includes("\0")) return true

  return false
}

/** Safe string to embed in LLM prompts as "source"; binary → short placeholder. */
export function rawContentForPrompt(filePath: string, content: string): string {
  if (!isLikelyBinaryFile(filePath, content)) return content

  const ext = fileExtension(filePath) || "binary"
  return `[Non-text or binary file (${ext}) — contents omitted from prompt.]`
}
