"use client"

import { useState } from "react"
import FileTree from "@/components/sidebar/file-tree"
import { Button } from "@/components/ui/button"
import { FolderOpen, RefreshCw } from "lucide-react"
import { pickFolderAndGetFiles } from "@/lib/file-system"
import { FileNode } from "@/types/file-node"
import { analyzeRepository } from "@/lib/repo-analyzer"

export default function Home() {

  const [dynamicFiles, setDynamicFiles] = useState<FileNode[] | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const [isPicking, setIsPicking] = useState(false)
  const [analysis, setAnalysis] = useState<any | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // collect all node IDs
  const collectIds = (nodes: FileNode[]): string[] => {
    let ids: string[] = []

    for (const node of nodes) {
      ids.push(node.id)

      if (node.children) {
        ids = ids.concat(collectIds(node.children))
      }
    }

    return ids
  }

  const handleSelectFolder = async () => {

    if (isPicking) return

    if (dynamicFiles) {
      const confirmChange = confirm(
        "Current folder will be closed. Do you want to select a new folder?"
      )

      if (!confirmChange) return

      setDynamicFiles(null)
      setSelectedFiles(new Set())
    }

    setIsPicking(true)

    try {

      const files = await pickFolderAndGetFiles()

      if (files.length === 0) {
        alert("Selected folder is empty. Please try again.")
      } else {

        setDynamicFiles(files)

        // ✅ select all nodes by default
        const allIds = collectIds(files)
        setSelectedFiles(new Set(allIds))
      }

    } catch (err: any) {

      if (err.name === "AbortError") {
        console.log("Folder selection cancelled by user")
      } else {
        alert("Folder selection failed. Please try again.")
        console.error(err)
      }

    } finally {
      setIsPicking(false)
    }
  }

  const handleAnalyzeRepository = async () => {

    if (!dynamicFiles || isAnalyzing) return

    setIsAnalyzing(true)

    try {

      const filterTree = (nodes: FileNode[]): FileNode[] => {

        return nodes
          .map((node) => {

            if (node.type === "file") {

              if (selectedFiles.has(node.id)) {
                return node
              }

              return null
            }

            if (node.children) {

              const filteredChildren = filterTree(node.children)

              if (filteredChildren.length > 0) {
                return { ...node, children: filteredChildren }
              }
            }

            return null
          })
          .filter(Boolean) as FileNode[]
      }

      const selectedTree = filterTree(dynamicFiles)

      const result = await analyzeRepository(selectedTree)

      setAnalysis(result)

      console.log("Repository Analysis:", result)

      alert("Repository analysis completed! Check console.")

    } catch (error) {

      console.error("Analysis failed:", error)
      alert("Repository analysis failed.")

    } finally {
      setIsAnalyzing(false)
    }
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
      <div className="w-full max-w-4xl px-6 py-10 space-y-6">

        {/* Title */}
        <h1 className="text-2xl font-semibold text-slate-800 text-center">
          Repo to Prompt Generator
        </h1>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">

          <Button
            onClick={handleSelectFolder}
            size="lg"
            disabled={isPicking}
            className="flex items-center gap-2 px-6 py-5 text-base cursor-pointer hover:scale-105 transition disabled:opacity-50"
          >
            <FolderOpen size={18}/>
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
              <RefreshCw size={18}/>
              {isAnalyzing ? "Analyzing..." : "Analyze Repository"}
            </Button>
          )}
        </div>

        {/* 🧠 Analysis Result */}
        {analysis && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">

            <h2 className="text-lg font-semibold text-slate-800">
              Repository Analysis
            </h2>

            {/* Summary (you can improve later) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">

              <div className="bg-slate-50 p-3 rounded">
                <div className="text-slate-500">Files</div>
                <div className="font-bold">
                  {analysis.totalFiles ?? "-"}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded">
                <div className="text-slate-500">Functions</div>
                <div className="font-bold">
                  {analysis.totalFunctions ?? "-"}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded">
                <div className="text-slate-500">Exports</div>
                <div className="font-bold">
                  {analysis.totalExports ?? "-"}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded">
                <div className="text-slate-500">Files Analyzed</div>
                <div className="font-bold">
                  {analysis.filesAnalyzed ?? "-"}
                </div>
              </div>

            </div>

            {/* Raw JSON (for debugging) */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">
                Raw Output
              </h3>

              <pre className="text-xs bg-slate-100 p-4 rounded overflow-auto max-h-64">
                {JSON.stringify(analysis, null, 2)}
              </pre>
            </div>

          </div>
        )}

      </div>

    </div>

  )
}