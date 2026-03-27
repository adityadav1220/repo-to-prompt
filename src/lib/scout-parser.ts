import { ScoutResult } from "@/types/scout-result"
import * as parser from "@babel/parser"
import traverse from "@babel/traverse"

/**
 * Parse file using Babel (supports TS + JSX)
 */
export function scoutFile(
  filePath: string,
  content: string
): ScoutResult {

  const imports: string[] = []
  const exports: string[] = []
  const functions: string[] = []
  const classes: string[] = []
  const frameworkHints: string[] = []

  let ast: any

  try {
    ast = parser.parse(content, {
      sourceType: "module",
      plugins: [
        "typescript",
        "jsx"
      ]
    })
  } catch (err) {
    console.log("Parse failed:", filePath, err)

    return {
      filePath,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      frameworkHints: []
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
    imports: [...new Set(imports.filter(Boolean))],
    exports: [...new Set(exports.filter(Boolean))],
    functions: [...new Set(functions.filter(Boolean))],
    classes: [...new Set(classes.filter(Boolean))],
    frameworkHints: [...new Set(frameworkHints)]
  }
}