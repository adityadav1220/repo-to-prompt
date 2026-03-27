"use client"

import { useState, useEffect } from "react"
import FileTree from "@/components/sidebar/file-tree"
import { Button } from "@/components/ui/button"
import { FolderOpen, RefreshCw, Copy } from "lucide-react"
import { pickFolderAndGetFiles } from "@/lib/file-system"
import { FileNode } from "@/types/file-node"
import { analyzeRepository } from "@/lib/repo-analyzer"
import RepoGraph from "@/components/RepoGraph"

export default function Home() {
  // ---------------- States ----------------
  const [dynamicFiles, setDynamicFiles] = useState<FileNode[] | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isPicking, setIsPicking] = useState(false)
  const [analysis, setAnalysis] = useState<any | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState("")
  const [tokenLimit, setTokenLimit] = useState(500)
  const [showGraph, setShowGraph] = useState(false)

  // ---------------- Helpers ----------------
  const collectIds = (nodes: FileNode[]): string[] => {
    let ids: string[] = []
    for (const node of nodes) {
      ids.push(node.id)
      if (node.children) ids = ids.concat(collectIds(node.children))
    }
    return ids
  }

  // ---------------- Folder Selection ----------------
  const handleSelectFolder = async () => {
    if (isPicking) return
    if (dynamicFiles) {
      const confirmChange = confirm(
        "Current folder will be closed. Do you want to select a new folder?"
      )
      if (!confirmChange) return
      setDynamicFiles(null)
      setSelectedFiles(new Set())
      setAnalysis(null)
      setGeneratedPrompt("")
    }

    setIsPicking(true)
    try {
      const files = await pickFolderAndGetFiles()
      if (!files.length) {
        alert("Selected folder is empty. Please try again.")
        return
      }
      setDynamicFiles(files)
      const allIds = collectIds(files)
      setSelectedFiles(new Set(allIds)) // select all by default
    } catch (err: any) {
      if (err.name === "AbortError") console.log("Folder selection cancelled")
      else {
        console.error(err)
        alert("Folder selection failed")
      }
    } finally {
      setIsPicking(false)
    }
  }

  // ---------------- Repository Analysis ----------------
  const handleAnalyzeRepository = async () => {
    if (!dynamicFiles || isAnalyzing) return
    setIsAnalyzing(true)
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

      const selectedTree = filterTree(dynamicFiles)
      const result = await analyzeRepository(selectedTree)
      setAnalysis(result)
      console.log("Repository Analysis:", result)
    } catch (err) {
      console.error(err)
      alert("Analysis failed")
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ---------------- Generate Prompt ----------------
  const generatePrompt = (analysis: any, limit: number) => {
    if (!analysis) return ""
    let prompt = `You are analyzing a user's code repository. Focus on the most important files first.\n\n`

    // Entry points first
    if (analysis.entryPoints?.length)
      prompt += `Entry Points:\n${analysis.entryPoints.join("\n")}\n\n`

    // Folder overview
    if (analysis.folders) {
      prompt += `Folders and their files:\n`
      for (const folder in analysis.folders) {
        prompt += `- ${folder}: ${analysis.folders[folder]
          .map((f: any) => f.filePath)
          .join(", ")}\n`
      }
      prompt += `\n`
    }

    // Files analysis
    prompt += `Files Analysis:\n`
    analysis.results.forEach((file: any) => {
      prompt += `File: ${file.filePath}\n`
      if (file.functions?.length) prompt += `Functions: ${file.functions.join(", ")}\n`
      if (file.exports?.length) prompt += `Exports: ${file.exports.join(", ")}\n`
      if (file.frameworkHints?.length)
        prompt += `Framework Hints: ${file.frameworkHints.join(", ")}\n`
      prompt += `\n`
    })

    // Limit tokens
    const words = prompt.split(" ")
    return words.length > limit ? words.slice(0, limit).join(" ") : prompt
  }

  // ---------------- Re-generate prompt whenever analysis or tokenLimit changes ----------------
  useEffect(() => {
    if (!analysis) return
    const newPrompt = generatePrompt(analysis, tokenLimit)
    setGeneratedPrompt(newPrompt)
  }, [analysis, tokenLimit])

  // ---------------- Copy Prompt ----------------
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt)
    alert("Prompt copied to clipboard!")
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r bg-slate-50 p-4">
        {dynamicFiles ? (
          <FileTree
            files={dynamicFiles}
            selected={selectedFiles}
            setSelected={setSelectedFiles}
          />
        ) : (
          <div className="text-slate-500 text-sm text-center mt-10">
            No folder selected
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="w-full max-w-6xl px-8 py-10 space-y-6 overflow-y-auto">
        <h1 className="text-3xl font-bold text-slate-800 text-center mb-6">
          Repo to Prompt Generator
        </h1>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Button
            onClick={handleSelectFolder}
            size="lg"
            disabled={isPicking}
            className="flex items-center gap-2 px-6 py-5 text-base hover:scale-105 transition disabled:opacity-50"
          >
            <FolderOpen size={18} />
            {dynamicFiles ? "Change Folder" : "Select Folder"}
          </Button>
          {dynamicFiles && (
            <Button
              onClick={handleAnalyzeRepository}
              size="lg"
              variant="outline"
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-6 py-5 text-base hover:scale-105 transition disabled:opacity-50"
            >
              <RefreshCw size={18} />
              {isAnalyzing ? "Analyzing..." : "Analyze Repository"}
            </Button>
          )}
        </div>

        {/* Prompt Section */}
        {analysis && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">Generated Prompt</h2>

            <div className="flex items-center gap-2 mt-2">
              <label className="text-sm text-slate-500">Token Limit:</label>
              <input
                type="number"
                min={50}
                max={5000}
                value={tokenLimit}
                onChange={(e) => setTokenLimit(Number(e.target.value))}
                className="border px-2 py-1 rounded w-20 text-sm"
              />
              <span className="text-slate-400 text-xs">
                {`Prompt Words: ${generatedPrompt.split(" ").length} / Limit: ${tokenLimit}`}
              </span>
            </div>

            <textarea
              readOnly
              value={generatedPrompt}
              rows={12}
              className="w-full border rounded p-3 font-mono text-sm bg-slate-50"
            />

            <Button
              onClick={handleCopyPrompt}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 mt-2"
            >
              <Copy size={16} /> Copy Prompt
            </Button>

            {/* Optional Graph Toggle */}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={showGraph}
                onChange={() => setShowGraph(!showGraph)}
              />
              <label className="text-sm text-slate-600">Show Dependency Graph</label>
            </div>

            {showGraph && (
              <div className="mt-4 h-[600px] w-full">
                <RepoGraph files={analysis.results} edges={analysis.edges} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}