import type { ScoutResult } from "@/types/scout-result"

export type FileFlowEdge = {
  source: string
  target: string
}

export type RepositoryAnalysis = {
  totalFiles: number
  totalFunctions: number
  totalExports: number
  filesAnalyzed: number
  edges: FileFlowEdge[]
  entryPoints: string[]
  folders: Record<string, ScoutResult[]>
  results: ScoutResult[]
  skippedLargeFiles: number
  readFailures: number
}
