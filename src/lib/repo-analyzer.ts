import { FileNode } from "@/types/file-node"
import type { ScoutResult } from "@/types/scout-result"
import type { FileFlowEdge, RepositoryAnalysis } from "@/types/analysis"
import { scoutFile, skippedScoutResult } from "./scout-parser"
import { resolveImportToFile } from "./resolve-import"

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024

export type AnalyzeOptions = {
  signal?: AbortSignal
  /** Max bytes per file before skipping full read (default 2 MiB). */
  maxFileBytes?: number
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/**
 * Analyze single file (read + scout). Respects abort and per-file size cap.
 */
export async function analyzeFileNode(
  node: FileNode,
  options?: { signal?: AbortSignal; maxFileBytes?: number }
): Promise<ScoutResult | null> {
  if (node.type !== "file" || !node.handle) return null

  const signal = options?.signal
  const maxFileBytes = options?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }

  let file: File
  try {
    file = await (node.handle as FileSystemFileHandle).getFile()
  } catch {
    return skippedScoutResult(node.id, "read-error")
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }

  if (file.size > maxFileBytes) {
    return skippedScoutResult(node.id, "too-large")
  }

  let content: string
  try {
    content = await file.text()
  } catch {
    return skippedScoutResult(node.id, "read-error")
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }

  return scoutFile(node.id, content)
}

function collectFilePaths(nodes: FileNode[], paths: string[] = []): string[] {
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

function buildEdges(results: ScoutResult[], allFiles: string[]): FileFlowEdge[] {
  const edges: FileFlowEdge[] = []
  const seen = new Set<string>()

  for (const file of results) {
    for (const imp of file.imports || []) {
      const resolved = resolveImportToFile(file.filePath, imp, allFiles)
      if (resolved) {
        const key = `${file.filePath}\0${resolved}`
        if (seen.has(key)) continue
        seen.add(key)
        edges.push({ source: file.filePath, target: resolved })
      }
    }
  }

  return edges
}

function detectEntryPoints(
  edges: FileFlowEdge[],
  results: ScoutResult[]
): string[] {
  const allTargets = new Set(edges.map((e) => e.target))
  const sourcesWithOutgoing = new Set(edges.map((e) => e.source))
  return results
    .filter(
      (file) =>
        !allTargets.has(file.filePath) && sourcesWithOutgoing.has(file.filePath)
    )
    .map((f) => f.filePath)
}

function groupByFolder(results: ScoutResult[]): Record<string, ScoutResult[]> {
  const folderMap: Record<string, ScoutResult[]> = {}

  for (const file of results) {
    const parts = file.filePath.split("/")
    const folder =
      parts.length > 1 ? parts[parts.length - 2] ?? "root" : "root"
    if (!folderMap[folder]) folderMap[folder] = []
    folderMap[folder].push(file)
  }

  return folderMap
}

async function walkFiles(
  nodes: FileNode[],
  opts: { signal?: AbortSignal; maxFileBytes: number },
  acc: {
    results: ScoutResult[]
    skippedLarge: number
    readFailures: number
  }
): Promise<void> {
  for (const node of nodes) {
    if (opts.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }

    if (node.type === "file") {
      const result = await analyzeFileNode(node, opts)
      if (result) {
        acc.results.push(result)
        if (result.readIssue === "too-large") acc.skippedLarge++
        if (result.readIssue === "read-error") acc.readFailures++
      }
      await yieldToMain()
    } else if (node.type === "folder" && node.children?.length) {
      await walkFiles(node.children, opts, acc)
    }
  }
}

export async function analyzeRepository(
  nodes: FileNode[],
  options?: AnalyzeOptions
): Promise<RepositoryAnalysis> {
  const acc = {
    results: [] as ScoutResult[],
    skippedLarge: 0,
    readFailures: 0
  }

  const opts = {
    signal: options?.signal,
    maxFileBytes: options?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
  }

  await walkFiles(nodes, opts, acc)

  const allFiles = collectFilePaths(nodes)

  let totalFunctions = 0
  let totalExports = 0
  for (const file of acc.results) {
    totalFunctions += file.functions?.length || 0
    totalExports += file.exports?.length || 0
  }

  const edges = buildEdges(acc.results, allFiles)
  const entryPoints = detectEntryPoints(edges, acc.results)
  const folders = groupByFolder(acc.results)

  return {
    totalFiles: acc.results.length,
    totalFunctions,
    totalExports,
    filesAnalyzed: acc.results.length,
    edges,
    entryPoints,
    folders,
    results: acc.results,
    skippedLargeFiles: acc.skippedLarge,
    readFailures: acc.readFailures
  }
}
