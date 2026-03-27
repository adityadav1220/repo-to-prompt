import { FileNode } from "@/types/file-node"
import { scoutFile } from "./scout-parser"

/**
 * Analyze single file
 */
export async function analyzeFileNode(node: FileNode) {
  if (node.type !== "file" || !node.handle) return null

  const file = await (node.handle as FileSystemFileHandle).getFile()
  const content = await file.text()

  return scoutFile(node.id, content)
}

/**
 * Collect all file paths
 */
function collectFilePaths(nodes: FileNode[], paths: string[] = []) {
  for (const node of nodes) {
    if (node.type === "file") {
      paths.push(node.id)
    }

    if (node.type === "folder" && node.children) {
      collectFilePaths(node.children, paths)
    }
  }

  return paths
}

/**
 * Normalize paths (./, ../)
 */
function normalizePath(path: string): string {
  const parts: string[] = []

  for (const segment of path.split("/")) {
    if (segment === "." || segment === "") continue
    if (segment === "..") {
      parts.pop()
    } else {
      parts.push(segment)
    }
  }

  return parts.join("/")
}

/**
 * Resolve imports (relative + alias)
 */
function resolveImportPath(
  sourcePath: string,
  importPath: string,
  allFiles: string[]
): string | null {

  let basePath = ""

  // alias (@/)
  if (importPath.startsWith("@/")) {
    basePath = importPath.replace("@/", "")
  }

  // relative
  else if (importPath.startsWith(".")) {
    const baseDir = sourcePath.split("/").slice(0, -1).join("/")
    basePath = normalizePath(`${baseDir}/${importPath}`)
  }

  // external
  else {
    return null
  }

  const possiblePaths = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`
  ]

  for (const p of possiblePaths) {
    if (allFiles.includes(p)) {
      return p
    }
  }

  return null
}

/**
 * Build edges
 */
type Edge = {
  source: string
  target: string
}

function buildEdges(results: any[], allFiles: string[]): Edge[] {
  const edges: Edge[] = []

  for (const file of results) {
    for (const imp of file.imports || []) {
      const resolved = resolveImportPath(
        file.filePath,
        imp,
        allFiles
      )

      if (resolved) {
        edges.push({
          source: file.filePath,
          target: resolved
        })
      }
    }
  }

  return edges
}

/**
 * Detect entry points
 */
function detectEntryPoints(edges: Edge[], results: any[]) {
  const allTargets = new Set(edges.map(e => e.target))

  return results
    .filter(file => {
      const isImported = allTargets.has(file.filePath)
      const hasOutgoing = edges.some(e => e.source === file.filePath)

      return !isImported && hasOutgoing
    })
    .map(file => file.filePath)
}

/**
 * Group by folder
 */
function groupByFolder(results: any[]) {
  const folderMap: Record<string, any[]> = {}

  for (const file of results) {
    const parts = file.filePath.split("/")
    const folder =
      parts.length > 1 ? parts[parts.length - 2] : "root"

    if (!folderMap[folder]) {
      folderMap[folder] = []
    }

    folderMap[folder].push(file)
  }

  return folderMap
}

/**
 * Main analyzer
 */
export async function analyzeRepository(nodes: FileNode[]) {
  const results: any[] = []

  for (const node of nodes) {
    if (node.type === "file") {
      const result = await analyzeFileNode(node)
      if (result) results.push(result)
    }

    if (node.type === "folder" && node.children) {
      const childResults = await analyzeRepository(node.children)
      results.push(...childResults.results)
    }
  }

  const allFiles = collectFilePaths(nodes)

  let totalFunctions = 0
  let totalExports = 0

  for (const file of results) {
    totalFunctions += file.functions?.length || 0
    totalExports += file.exports?.length || 0
  }

  const edges = buildEdges(results, allFiles)
  const entryPoints = detectEntryPoints(edges, results)
  const folders = groupByFolder(results)

  return {
    totalFiles: results.length,
    totalFunctions,
    totalExports,
    filesAnalyzed: results.length,

    edges,
    entryPoints,
    folders,

    results
  }
}