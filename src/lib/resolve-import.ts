/**
 * Map import / include spec strings to workspace file paths (best-effort, language-agnostic).
 */

function dirname(path: string): string {
  const i = path.lastIndexOf("/")
  return i <= 0 ? "" : path.slice(0, i)
}

export function normalizePathSegments(path: string): string {
  const parts: string[] = []
  for (const segment of path.split("/")) {
    if (segment === "." || segment === "") continue
    if (segment === "..") parts.pop()
    else parts.push(segment)
  }
  return parts.join("/")
}

const SOURCE_EXTENSIONS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".py",
  ".pyw",
  ".pyi",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".rb",
  ".php",
  ".cs",
  ".swift",
  ".c",
  ".cc",
  ".cpp",
  ".cxx",
  ".h",
  ".hpp",
  ".hh",
  ".vue",
  ".svelte",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".sql",
  ".sh",
  ".astro",
  ".mdx"
]

const INDEX_FILES = [
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "index.mjs",
  "index.cjs",
  "mod.rs",
  "__init__.py",
  "__main__.py"
]

function buildCandidates(baseWithoutExt: string): string[] {
  const c: string[] = []
  for (const ext of SOURCE_EXTENSIONS) {
    if (ext) c.push(`${baseWithoutExt}${ext}`)
  }
  for (const idx of INDEX_FILES) {
    c.push(`${baseWithoutExt}/${idx}`)
  }
  return c
}

function firstExisting(candidates: string[], allFiles: Set<string>): string | null {
  for (const p of candidates) {
    if (allFiles.has(p)) return p
  }
  return null
}

/** Python-style relative: `.models`, `..pkg.sub` */
function pythonRelativeToCandidates(
  sourcePath: string,
  spec: string,
  allFiles: Set<string>
): string | null {
  const m = spec.match(/^(\.+)(.*)$/)
  if (!m) return null
  const dotLen = m[1].length
  let rest = m[2]
  if (rest.startsWith(".")) rest = rest.slice(1)

  let base = dirname(sourcePath)
  const up = Math.max(0, dotLen - 1)
  for (let j = 0; j < up; j++) {
    base = dirname(base)
  }

  if (!rest) return null
  const subPath = rest.replace(/\./g, "/")
  const joined = base ? `${base}/${subPath}` : subPath
  return firstExisting(buildCandidates(joined), allFiles)
}

/** Java/Kotlin `com.foo.Bar` → com/foo/Bar.java */
function javaLikeToCandidates(spec: string, allFiles: Set<string>): string | null {
  if (!/^[a-z_]\w*(\.[a-z_]\w*)+$/i.test(spec)) return null
  const slashPath = spec.replace(/\./g, "/")
  for (const ext of [".java", ".kt", ".kts"]) {
    const p = `${slashPath}${ext}`
    if (allFiles.has(p)) return p
  }
  return firstExisting(buildCandidates(slashPath), allFiles)
}

/** PHP namespace use: php:App\\Models\\User */
function phpUseToCandidates(spec: string, allFiles: Set<string>): string | null {
  if (!spec.startsWith("php:")) return null
  const path = spec.slice(4).replace(/\\/g, "/")
  const withPhp = `${path}.php`
  if (allFiles.has(withPhp)) return withPhp
  return firstExisting(buildCandidates(path), allFiles)
}

function tailMatchCandidates(importPath: string, allFiles: Set<string>): string | null {
  const norm = importPath.replace(/\\/g, "/").replace(/^\/+/, "")
  const parts = norm.split("/").filter(Boolean)
  for (let take = parts.length; take >= 1; take--) {
    const tail = parts.slice(-take).join("/")
    for (const f of allFiles) {
      if (f === tail || f.endsWith("/" + tail)) return f
    }
  }
  return null
}

export function resolveImportToFile(
  sourcePath: string,
  importPath: string,
  allFilesList: string[]
): string | null {
  const allFiles = new Set(allFilesList)
  let spec = importPath.trim()
  if (!spec) return null

  if (spec.startsWith("rel:")) {
    const rel = spec.slice(4)
    const baseDir = dirname(sourcePath)
    const joined = normalizePathSegments(
      baseDir ? `${baseDir}/${rel}` : rel
    )
    return firstExisting(buildCandidates(joined.replace(/\.rb$/, "")), allFiles) ||
      firstExisting(buildCandidates(joined), allFiles) ||
      (allFiles.has(joined) ? joined : null)
  }

  const phpResolved = phpUseToCandidates(spec, allFiles)
  if (phpResolved) return phpResolved

  if (spec.startsWith("@/")) {
    const basePath = spec.slice(2)
    const joined = normalizePathSegments(basePath)
    return firstExisting(buildCandidates(joined), allFiles)
  }

  if (spec.startsWith("./") || spec.startsWith("../")) {
    const baseDir = dirname(sourcePath)
    const joined = normalizePathSegments(`${baseDir}/${spec}`)
    return firstExisting(buildCandidates(joined), allFiles)
  }

  const pyRel = pythonRelativeToCandidates(sourcePath, spec, allFiles)
  if (pyRel) return pyRel

  if (/^[a-z_]\w*(\.[a-z_]\w*)+$/i.test(spec)) {
    const javaHit = javaLikeToCandidates(spec, allFiles)
    if (javaHit) return javaHit

    const slashPath = spec.replace(/\./g, "/")
    const hit = firstExisting(buildCandidates(slashPath), allFiles)
    if (hit) return hit
    const pyInit = `${slashPath}/__init__.py`
    if (allFiles.has(pyInit)) return pyInit
  }

  if (spec.includes("/") && !/^https?:\/\//i.test(spec)) {
    const byTail = tailMatchCandidates(spec, allFiles)
    if (byTail) return byTail
    const baseDir = dirname(sourcePath)
    const joined = normalizePathSegments(
      spec.startsWith("/") ? spec.slice(1) : `${baseDir}/${spec}`
    )
    if (joined) {
      const hit = firstExisting(buildCandidates(joined), allFiles)
      if (hit) return hit
    }
  }

  return null
}
