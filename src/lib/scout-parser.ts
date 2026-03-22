import { ScoutResult } from "@/types/scout-result"

export function scoutFile(
  filePath: string,
  content: string
): ScoutResult {

  const lines = content.split("\n").slice(0, 40)

  const imports: string[] = []
  const exports: string[] = []
  const functions: string[] = []
  const classes: string[] = []
  const frameworkHints: string[] = []

  for (const line of lines) {

    const trimmed = line.trim()

    // IMPORTS
    if (trimmed.startsWith("import")) {
      imports.push(trimmed)

      if (trimmed.includes("react")) frameworkHints.push("React")
      if (trimmed.includes("next")) frameworkHints.push("Next.js")
      if (trimmed.includes("express")) frameworkHints.push("Express")
      if (trimmed.includes("vue")) frameworkHints.push("Vue")
      if (trimmed.includes("@angular")) frameworkHints.push("Angular")
    }

    // EXPORTS
    if (trimmed.startsWith("export")) {
      exports.push(trimmed)

      if (trimmed.startsWith("export default")) {
        exports.push("default")
      }
    }

    // FUNCTION (normal)
    const funcMatch = trimmed.match(/function\s+([a-zA-Z0-9_]+)/)
    if (funcMatch) {
      functions.push(funcMatch[1])
    }

    // ARROW FUNCTION (improved)
    const arrowMatch = trimmed.match(
      /const\s+([a-zA-Z0-9_]+)\s*=\s*(async\s*)?\(/
    )
    if (arrowMatch) {
      functions.push(arrowMatch[1])
    }

    // CLASS
    const classMatch = trimmed.match(/class\s+([a-zA-Z0-9_]+)/)
    if (classMatch) {
      classes.push(classMatch[1])
    }

    // REACT HOOK DETECTION
    if (
      trimmed.includes("useState") ||
      trimmed.includes("useEffect")
    ) {
      frameworkHints.push("React Component")
    }

    // NEXT CLIENT COMPONENT
    if (
      trimmed.includes('"use client"') ||
      trimmed.includes("'use client'")
    ) {
      frameworkHints.push("Next.js Client Component")
    }

  }

  return {
    filePath,
    imports: [...new Set(imports)],
    exports: [...new Set(exports)],
    functions: [...new Set(functions)],
    classes: [...new Set(classes)],
    frameworkHints: [...new Set(frameworkHints)]
  }
}