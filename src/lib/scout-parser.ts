import { ScoutResult } from "@/types/scout-result"
import * as parser from "@babel/parser"
import traverse from "@babel/traverse"
import { isLikelyBinaryFile, rawContentForPrompt } from "@/lib/text-file-guard"
import { extractCrossLanguageImports } from "@/lib/import-extractor"

/**
 * Parse file using Babel (supports TS + JSX)
 */
export function scoutFile(filePath: string, content: string): ScoutResult {
  const imports: string[] = []
  const exports: string[] = []
  const functions: string[] = []
  const classes: string[] = []
  const frameworkHints: string[] = []
  const propTypes: string[] = []

  if (isLikelyBinaryFile(filePath, content)) {
    return {
      filePath,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      frameworkHints: [],
      propTypes: [],
      raw: rawContentForPrompt(filePath, content)
    }
  }

  const heuristicImports = extractCrossLanguageImports(filePath, content)

  let ast: any

  try {
    ast = parser.parse(content, {
      sourceType: "module",
      plugins: ["typescript", "jsx"]
    })
  } catch {
    return {
      filePath,
      imports: [...new Set(heuristicImports)],
      exports: [],
      functions: [],
      classes: [],
      frameworkHints: [],
      propTypes: [],
      raw: rawContentForPrompt(filePath, content)
    }
  }

  traverse(ast, {
    // IMPORTS
    ImportDeclaration(path: any) {
      const val = path.node.source.value
      imports.push(val)

      if (val.includes("react")) frameworkHints.push("React")
      if (val.includes("next")) frameworkHints.push("Next.js")
      if (val.includes("express")) frameworkHints.push("Express")
    },

    // EXPORTS
    ExportNamedDeclaration(path: any) {
      const node = path.node

      if (node.declaration) {
        if (node.declaration.id?.name) {
          exports.push(node.declaration.id.name)
        }

        if (node.declaration.declarations) {
          for (const decl of node.declaration.declarations) {
            if (decl.id?.name) {
              exports.push(decl.id.name)
            }
          }
        }
      }

      // export { a, b }
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          exports.push(spec.exported.name)
        }
      }
    },

    ExportDefaultDeclaration() {
      exports.push("default")
    },

    // FUNCTIONS
    FunctionDeclaration(path: any) {
      if (path.node.id?.name) {
        functions.push(path.node.id.name)
      }
    },

    VariableDeclarator(path: any) {
      const init = path.node.init

      if (
        init &&
        (init.type === "ArrowFunctionExpression" ||
          init.type === "FunctionExpression")
      ) {
        if (path.node.id?.name) {
          functions.push(path.node.id.name)
        }
      }
    },

    // CLASSES
    ClassDeclaration(path: any) {
      if (path.node.id?.name) {
        classes.push(path.node.id.name)
      }
    },

    // React-style prop containers (interfaces / type aliases ending in "Props")
    TSInterfaceDeclaration(path: any) {
      const name = path.node.id?.name
      if (name && name.toLowerCase().includes("props")) {
        propTypes.push(name)
      }
    },
    TSTypeAliasDeclaration(path: any) {
      const name = path.node.id?.name
      if (name && name.toLowerCase().includes("props")) {
        propTypes.push(name)
      }
    }
  })

  // extra hints
  if (content.includes("useState") || content.includes("useEffect")) {
    frameworkHints.push("React Component")
  }

  if (content.includes('"use client"') || content.includes("'use client'")) {
    frameworkHints.push("Next.js Client Component")
  }

  return {
    filePath,
    imports: [
      ...new Set([...imports.filter(Boolean), ...heuristicImports])
    ],
    exports: [...new Set(exports.filter(Boolean))],
    functions: [...new Set(functions.filter(Boolean))],
    classes: [...new Set(classes.filter(Boolean))],
    frameworkHints: [...new Set(frameworkHints)],
    propTypes: [...new Set(propTypes.filter(Boolean))],
    raw: rawContentForPrompt(filePath, content)
  }
}

export function skippedScoutResult(
  filePath: string,
  kind: "too-large" | "read-error"
): ScoutResult {
  const raw =
    kind === "too-large"
      ? "[File omitted: exceeds browser analysis size limit.]"
      : "[File could not be read.]"
  return {
    filePath,
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    frameworkHints: [],
    propTypes: [],
    raw,
    readIssue: kind
  }
}