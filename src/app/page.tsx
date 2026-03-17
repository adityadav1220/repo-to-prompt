"use client"

import { useState } from "react"
import FileTree from "@/components/sidebar/file-tree"
import { Button } from "@/components/ui/button"
import { FolderOpen, RefreshCw } from "lucide-react"
import { FileNode, pickFolderAndGetFiles } from "@/lib/file-system"

export default function Home() {
  const [dynamicFiles, setDynamicFiles] = useState<FileNode[] | null>(null)
  const [isPicking, setIsPicking] = useState(false)

  const handleSelectFolder = async () => {
    if (isPicking) return

    // Clear existing folder if any
    if (dynamicFiles) {
      const confirmChange = confirm(
        "Current folder will be closed. Do you want to select a new folder?"
      )
      if (!confirmChange) return
      setDynamicFiles(null)
    }

    setIsPicking(true)
    try {
      const files = await pickFolderAndGetFiles()
      if (files.length === 0) {
        alert("Selected folder is empty. Please try again.")
      } else {
        setDynamicFiles(files)
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

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r bg-slate-50 p-4">
        {dynamicFiles ? (
          <FileTree files={dynamicFiles} />
        ) : (
          <div className="text-slate-500 text-sm text-center mt-10">
            No folder selected
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center bg-slate-100 relative">
        <div className="text-center space-y-6 relative z-10">
          <h1 className="text-2xl font-semibold text-slate-800">
            Repo to Prompt Generator
          </h1>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleSelectFolder}
              size="lg"
              disabled={isPicking}
              className="flex items-center gap-2 px-6 py-5 text-base cursor-pointer hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FolderOpen size={18}/>
              {dynamicFiles ? "Change Folder" : "Select Folder"}
            </Button>

            {dynamicFiles && (
              <Button
                onClick={() => alert("Add your extra action here")}
                size="lg"
                variant="outline"
                className="flex items-center gap-2 px-6 py-5 text-base hover:scale-105 transition"
              >
                <RefreshCw size={18}/>
                Another Action
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}