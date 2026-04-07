/**
 * Language-agnostic + supplemental JS import strings for dependency edges.
 * Babel handles ESM/TS static imports; this adds require(), dynamic import(),
 * and common non-JS patterns (Python, Go, Rust, Ruby, C/C++, PHP, Java/Kotlin, etc.).
 */

function uniq(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))]
}

function extOf(path: string): string {
  const base = path.split("/").pop() ?? path
  const i = base.lastIndexOf(".")
  return i >= 0 ? base.slice(i).toLowerCase() : ""
}

/** Heuristic: file likely contains JS/TS module syntax worth scanning. */
function looksLikeJsModule(path: string, content: string): boolean {
  const e = extOf(path)
  if (/^\.(m?[jt]sx?|cjs|vue|svelte|astro)$/i.test(e)) return true
  if (
    [
      ".py",
      ".pyw",
      ".pyi",
      ".go",
      ".rs",
      ".java",
      ".rb",
      ".php",
      ".kt",
      ".kts",
      ".cs",
      ".swift",
      ".scala",
      ".clj",
      ".ex",
      ".exs",
      ".erl",
      ".hs",
      ".ml",
      ".fs"
    ].includes(e)
  ) {
    return false
  }
  return /\b(import\s+[\w*{]|from\s+['"]|require\s*\(|import\s*\()/.test(
    content
  )
}

function extractJsLikeStrings(content: string): string[] {
  const out: string[] = []

  for (const m of content.matchAll(
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  )) {
    out.push(m[1])
  }

  for (const m of content.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    out.push(m[1])
  }

  for (const m of content.matchAll(
    /\b(?:import|export)\s+[^'";]*?\s+from\s+['"]([^'"]+)['"]/g
  )) {
    out.push(m[1])
  }

  for (const m of content.matchAll(/^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm)) {
    out.push(m[1])
  }

  return out
}

function extractPythonImports(content: string): string[] {
  const out: string[] = []

  for (const m of content.matchAll(/^\s*from\s+\.+\s+import\s+([\w\s,]+)/gm)) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+/)[0])
    for (const n of names) {
      if (n && n !== "import") out.push(`./${n}`)
    }
  }

  for (const m of content.matchAll(
    /^\s*from\s+(\.{1,2}[\w.]*)\s+import/gm
  )) {
    const mod = m[1]
    if (/^\.+$/.test(mod)) continue
    out.push(mod)
  }

  for (const m of content.matchAll(
    /^\s*from\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+import/gm
  )) {
    out.push(m[1])
  }

  for (const m of content.matchAll(
    /^\s*import\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s+as\s+\w+)?\s*(?:#.*)?$/gm
  )) {
    out.push(m[1])
  }

  return out
}

function extractGoImports(content: string): string[] {
  const out: string[] = []
  const pushGo = (s: string) => {
    if (s.startsWith(".")) out.push(s)
    else if (s.includes("/")) {
      out.push(s)
      const tail = s.split("/").pop()
      if (tail && !tail.includes(".")) out.push("./" + tail)
    }
  }
  const block = content.match(/import\s*\(([\s\S]*?)\)/)
  if (block) {
    for (const m of block[1].matchAll(/"([^"]+)"/g)) pushGo(m[1])
  }
  for (const m of content.matchAll(/^\s*import\s+"(.+)"\s*$/gm)) {
    pushGo(m[1])
  }
  return out
}

function extractRustRefs(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(/^\s*(?:pub\s+)?mod\s+([\w_]+)\s*;/gm)) {
    out.push(`./${m[1]}`)
  }
  for (const m of content.matchAll(
    /^\s*use\s+((?:crate|self|super)::[^;{]+)/gm
  )) {
    let s = m[1]
      .replace(/^crate::/, "./")
      .replace(/^self::/, "./")
      .replace(/^super::/, "../")
      .replace(/::/g, "/")
    if (s.startsWith("./") || s.startsWith("../")) out.push(s)
  }
  return out
}

function extractJavaFamilyImports(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(
    /^\s*import\s+([\w.]+)\s*;/gm
  )) {
    const imp = m[1]
    if (imp.startsWith("java.") || imp.startsWith("javax.")) continue
    if (imp.startsWith("kotlin.") || imp.startsWith("android.")) continue
    out.push(imp)
  }
  return out
}

function extractRubyRequires(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(/\brequire_relative\s+['"]([^'"]+)['"]/g)) {
    out.push(`rel:${m[1]}`)
  }
  for (const m of content.matchAll(/\brequire\s+['"]([^'"]+)['"]/g)) {
    out.push(m[1])
  }
  return out
}

function extractCIncludes(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(/#include\s+"([^"]+)"/g)) {
    out.push(m[1])
  }
  return out
}

function extractPhpUses(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(
    /^\s*(?:require|require_once|include|include_once)\s*\(?\s*['"]([^'"]+)['"]/gim
  )) {
    out.push(m[1])
  }
  for (const m of content.matchAll(/^\s*use\s+([\w\\]+)\s*;/gm)) {
    out.push(`php:${m[1]}`)
  }
  return out
}

function extractCssImports(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
    out.push(m[1])
  }
  return out
}

function extractShellSources(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(/^\s*(?:source|\.\s+)\s*['"]?([^\s'"]+)['"]?/gm)) {
    const p = m[1]
    if (p.startsWith(".") || p.includes("/")) out.push(p)
  }
  return out
}

/**
 * Collect import / include spec strings (same shape as JS `import` source strings where possible).
 */
export function extractCrossLanguageImports(
  filePath: string,
  content: string
): string[] {
  const out: string[] = []
  const ext = extOf(filePath)

  if (looksLikeJsModule(filePath, content)) {
    out.push(...extractJsLikeStrings(content))
  }

  if (ext === ".py" || ext === ".pyw" || ext === ".pyi") {
    out.push(...extractPythonImports(content))
  }

  if (ext === ".go") {
    out.push(...extractGoImports(content))
  }

  if (ext === ".rs") {
    out.push(...extractRustRefs(content))
  }

  if (ext === ".java" || ext === ".kt" || ext === ".kts") {
    out.push(...extractJavaFamilyImports(content))
  }

  if (ext === ".rb" || ext === ".rake") {
    out.push(...extractRubyRequires(content))
  }

  if (
    [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".m", ".mm"].includes(
      ext
    )
  ) {
    out.push(...extractCIncludes(content))
  }

  if (ext === ".php") {
    out.push(...extractPhpUses(content))
  }

  if ([".css", ".scss", ".sass", ".less"].includes(ext)) {
    out.push(...extractCssImports(content))
  }

  if ([".sh", ".bash", ".zsh"].includes(ext)) {
    out.push(...extractShellSources(content))
  }

  return uniq(out)
}
