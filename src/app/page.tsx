"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { 
  FolderOpen, 
  RefreshCw, 
  Copy, 
  Maximize2, 
  X,
  CheckCircle2,
  Terminal,
  Code2,
  Network,
  Loader2
} from "lucide-react"

// UI Components
import FileTree from "@/components/sidebar/file-tree"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

// Libs & Types
import { pickFolderAndGetFiles } from "@/lib/file-system"
import { FileNode } from "@/types/file-node"
import { analyzeRepository } from "@/lib/repo-analyzer"
import { codeFenceLanguage } from "@/lib/text-file-guard"
import type { RepositoryAnalysis } from "@/types/analysis"
import type { ScoutResult } from "@/types/scout-result"
import FileFlowAnalyzer from "@/components/RepoGraph"

type PromptSize = "low" | "medium" | "high"
type FlowDirection = "upstream" | "downstream" | "bidirectional"

function SectionLoadingOverlay({
  show,
  label
}: {
  show: boolean
  label: string
}) {
  if (!show) return null
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-white/90 dark:bg-slate-950/90 backdrop-blur-[2px]"
      aria-busy="true"
      aria-label={label}
    >
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
    </div>
  )
}

const IMPORT_LIST_CAP = 48

function appendImportList(p: string, imports: string[]): string {
  if (!imports.length) return p
  if (imports.length <= IMPORT_LIST_CAP) {
    return p + ` - Imports: ${imports.join(", ")}\n`
  }
  return (
    p +
    ` - Imports: ${imports.slice(0, IMPORT_LIST_CAP).join(", ")} … +${imports.length - IMPORT_LIST_CAP} more\n`
  )
}

function generatePromptText(
  data: RepositoryAnalysis,
  size: PromptSize
): string {
  let p = `Project Context Overview:\n\n`
  if (data.entryPoints?.length) {
    p += `Entry Points: ${data.entryPoints.join(", ")}\n`
  }

  if (size === "low") {
    return p + `Files: ${data.results.map((f) => f.filePath).join(", ")}`
  }

  data.results.forEach((file: ScoutResult) => {
    p += `\nFILE: ${file.filePath}\n`
    if (file.readIssue === "too-large") {
      p += ` - Note: full content omitted (file exceeds analysis size limit)\n`
    } else if (file.readIssue === "read-error") {
      p += ` - Note: file could not be read\n`
    }
    if (size === "medium" || size === "high") {
      p = appendImportList(p, file.imports)
      if (file.exports?.length) {
        p += ` - Exports: ${file.exports.join(", ")}\n`
      }
      if (file.classes?.length) {
        p += ` - Classes: ${file.classes.join(", ")}\n`
      }
      if (file.functions?.length) {
        p += ` - Functions: ${file.functions.join(", ")}\n`
      }
      if (file.propTypes?.length) {
        p += ` - Prop types: ${file.propTypes.join(", ")}\n`
      }
      if (file.frameworkHints?.length) {
        p += ` - Framework hints: ${file.frameworkHints.join(", ")}\n`
      }
    }
    if (size === "high" && file.raw) {
      const lang = codeFenceLanguage(file.filePath)
      p += `\`\`\`${lang}\n${file.raw}\n\`\`\`\n`
    }
  })
  return p
}

export default function Home() {
  const analyzeAbortRef = useRef<AbortController | null>(null)

  // ---------------- States ----------------
  const [dynamicFiles, setDynamicFiles] = useState<FileNode[] | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isPicking, setIsPicking] = useState(false)
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState("")
  const [promptSize, setPromptSize] = useState<PromptSize>("medium")
  const [flowFile, setFlowFile] = useState<string | null>(null)
  const [flowDirection, setFlowDirection] = useState<FlowDirection>("upstream")
  const [isFlowExpanded, setIsFlowExpanded] = useState(false)
  const [canAnalyze, setCanAnalyze] = useState(false)
  const [showFolderChangeDialog, setShowFolderChangeDialog] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    return () => analyzeAbortRef.current?.abort()
  }, [])

  // ---------------- Helpers ----------------
  const collectIds = useCallback((nodes: FileNode[]): string[] => {
    let ids: string[] = []
    for (const node of nodes) {
      ids.push(node.id)
      if (node.children) ids = ids.concat(collectIds(node.children))
    }
    return ids
  }, [])

  const runFolderSelection = async () => {
    analyzeAbortRef.current?.abort()
    setIsPicking(true)
    setNotice(null)
    try {
      const files = await pickFolderAndGetFiles()
      if (!files.length) return
      setDynamicFiles(files)
      setSelectedFiles(new Set(collectIds(files)))
      setAnalysis(null)
      setGeneratedPrompt("")
      setCanAnalyze(true)
      setFlowFile(null)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      const message =
        err instanceof Error ? err.message : "Could not open folder"
      setNotice(message)
      console.error(err)
    } finally {
      setIsPicking(false)
    }
  }

  const handleAnalyzeRepository = async () => {
    if (!dynamicFiles || isAnalyzing || !canAnalyze) return
    analyzeAbortRef.current?.abort()
    const controller = new AbortController()
    analyzeAbortRef.current = controller
    setIsAnalyzing(true)
    setNotice(null)
    try {
      const filterTree = (nodes: FileNode[]): FileNode[] => {
        return nodes
          .map((node) => {
            if (node.type === "file") return selectedFiles.has(node.id) ? node : null
            if (node.children) {
              const filteredChildren = filterTree(node.children)
              if (filteredChildren.length > 0) return { ...node, children: filteredChildren }
            }
            return null
          })
          .filter(Boolean) as FileNode[]
      }
      const result = await analyzeRepository(filterTree(dynamicFiles), {
        signal: controller.signal
      })
      setAnalysis(result)
      setCanAnalyze(false)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      const message =
        err instanceof Error ? err.message : "Analysis failed"
      setNotice(message)
      console.error(err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    if (analysis) setGeneratedPrompt(generatePromptText(analysis, promptSize))
  }, [analysis, promptSize])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      setCopied(true)
      setCopyFailed(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 2500)
    }
  }

  const fileOptions = useMemo(
    () => analysis?.results.map((f) => f.filePath) || [],
    [analysis]
  )
  const tokenCount = useMemo(() => generatedPrompt.split(/\s+/).filter(Boolean).length, [generatedPrompt])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-6">
        
        {/* Sidebar: File Tree */}
        <aside className="w-full lg:w-72 shrink-0">
          <Card className="sticky top-6 h-fit max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col border-slate-200">
            <CardHeader className="border-b py-4 bg-white dark:bg-slate-900">
              <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-tighter text-slate-500">
                <Terminal size={14} /> Repository
              </CardTitle>
            </CardHeader>
            <CardContent className="relative flex-1 overflow-y-auto p-2 min-h-[120px]">
              <SectionLoadingOverlay show={isPicking} label="Loading folder…" />
              {dynamicFiles ? (
                <FileTree files={dynamicFiles} selected={selectedFiles} setSelected={setSelectedFiles} onSelectionChange={() => setCanAnalyze(true)} />
              ) : (
                <div className="py-20 text-center text-xs text-slate-400">Select folder to start</div>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {notice && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
            >
              <p className="leading-relaxed pt-0.5">{notice}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="shrink-0 rounded-md p-1 text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/50"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Action Header */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Repo to Prompt</h1>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">
                    Generate clean, structured LLM prompts from any repo —{" "}
                    <span className="font-semibold text-slate-700">
                      analysis runs entirely in your browser, your code never leaves your machine.
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Optimized for <span className="font-semibold">JavaScript / TypeScript / React / Next.js</span> projects with rich function, export and dependency insights.
                    Other stacks get the same local-first treatment: raw files in prompts plus a <span className="font-semibold">best-effort file-flow graph</span> from imports, includes, and module declarations (Python, Go, Rust, Ruby, Java/Kotlin, PHP, C/C++, shell, CSS, and more).
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => dynamicFiles ? setShowFolderChangeDialog(true) : runFolderSelection()}>
                  <FolderOpen className="mr-2 h-4 w-4" /> {dynamicFiles ? "Change" : "Select"}
                </Button>
                {dynamicFiles && (
                  <Button onClick={handleAnalyzeRepository} disabled={isAnalyzing || !canAnalyze} className="bg-blue-600 hover:bg-blue-700">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                    Analyze
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Prompt Output Card */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b py-4 px-6 bg-white dark:bg-slate-900">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Code2 size={18} className="text-blue-500" />
                  <CardTitle className="text-sm">Prompt Output</CardTitle>
                </div>
                <p className="text-[11px] text-slate-500">
                  <span className="font-semibold">Low</span> = structural overview,{" "}
                  <span className="font-semibold">Medium</span> = per-file context (imports, functions, exports, props, hints),{" "}
                  <span className="font-semibold">High</span> = Medium + full raw source for selected files.
                </p>
                {analysis &&
                  (analysis.skippedLargeFiles > 0 || analysis.readFailures > 0) && (
                    <p className="text-[10px] text-amber-800 dark:text-amber-200/90">
                      {analysis.skippedLargeFiles > 0 &&
                        `${analysis.skippedLargeFiles} file(s) skipped (over 2 MB). `}
                      {analysis.readFailures > 0 &&
                        `${analysis.readFailures} file(s) could not be read.`}
                    </p>
                  )}
              </div>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {(["low", "medium", "high"] as PromptSize[]).map((s) => (
                  <button key={s} onClick={() => setPromptSize(s)} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition ${promptSize === s ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0 relative min-h-[320px]">
              <SectionLoadingOverlay show={isAnalyzing} label="Analyzing repository…" />
              <textarea
                readOnly
                placeholder="Analyze repository to generate prompt..."
                value={generatedPrompt}
                className="w-full h-80 p-4 font-mono text-[12px] bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none resize-none border-none"
              />
              {analysis && (
                <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-white/80 dark:bg-slate-900/80">
                      ~{tokenCount} words (approx.)
                    </Badge>
                    <Button size="sm" onClick={handleCopy} className="rounded-xl shadow-lg">
                      {copied ? <CheckCircle2 size={14} className="mr-2" /> : <Copy size={14} className="mr-2" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  {copyFailed && (
                    <span className="text-[10px] text-red-600 dark:text-red-400">
                      Clipboard unavailable — copy manually
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dependency Flow Card */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b py-4 px-6 bg-white dark:bg-slate-900">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Network size={18} className="text-indigo-500" />
                  <CardTitle className="text-sm">File Flow Analyzer</CardTitle>
                </div>
                <p className="text-[11px] text-slate-500">
                  <span className="font-semibold">Upstream</span> shows files that feed into the target file (its dependencies),{" "}
                  <span className="font-semibold">Downstream</span> shows files that depend on the target, and{" "}
                  <span className="font-semibold">Bidirectional</span> combines both for a full neighborhood view.
                </p>
              </div>
              {analysis && (
                <Button variant="ghost" size="sm" onClick={() => setIsFlowExpanded(true)} className="h-8 text-xs">
                  <Maximize2 size={14} className="mr-2" /> Expand
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select
                  value={flowFile ?? ""}
                  onChange={(e) => setFlowFile(e.target.value || null)}
                  className="w-full bg-white dark:bg-slate-900 border rounded-md px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Target File...</option>
                  {fileOptions.map((path: string) => <option key={path} value={path}>{path}</option>)}
                </select>
                <div className="flex border rounded-md p-0.5 bg-slate-50 dark:bg-slate-800">
                  {(["upstream", "downstream", "bidirectional"] as FlowDirection[]).map((d) => (
                    <button key={d} onClick={() => setFlowDirection(d)} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition ${flowDirection === d ? "bg-slate-900 text-white shadow-sm" : "text-slate-500"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative h-[400px] rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <SectionLoadingOverlay show={isAnalyzing} label="Mapping file dependencies…" />
                {analysis ? (
                  <FileFlowAnalyzer files={analysis.results} edges={analysis.edges} selectedFile={flowFile} direction={flowDirection} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Analysis required to map dependencies</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* FULLSCREEN GRAPH MODAL */}
      {isFlowExpanded && analysis && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold">Dependency Visualization</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">{flowFile || "Entire Repo"}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsFlowExpanded(false)}>
              <X size={16} className="mr-2" /> Close Fullscreen
            </Button>
          </div>
          <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
            <FileFlowAnalyzer files={analysis.results} edges={analysis.edges} selectedFile={flowFile} direction={flowDirection} />
          </div>
        </div>
      )}

      {/* FOLDER CHANGE DIALOG */}
      {showFolderChangeDialog && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="max-w-sm w-full shadow-2xl">
            <CardHeader>
              <CardTitle>Switch Project?</CardTitle>
              <CardDescription className="text-xs">Your current progress and analysis will be reset.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowFolderChangeDialog(false)}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { setShowFolderChangeDialog(false); runFolderSelection(); }}>Confirm</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}