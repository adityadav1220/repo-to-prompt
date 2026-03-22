import { FileNode } from "@/types/file-node"
import { scoutFile } from "./scout-parser"

export async function analyzeFileNode(node: FileNode) {

  if (node.type !== "file" || !node.handle) return null

  const file = await (node.handle as FileSystemFileHandle).getFile()
  const content = await file.text()

  return scoutFile(node.id, content)
}

export async function analyzeRepository(nodes: FileNode[]) {

  const results: any[] = []

  for (const node of nodes) {

    if (node.type === "file") {

      const result = await analyzeFileNode(node)

      if (result) results.push(result)

    }

    if (node.type === "folder" && node.children) {

      const childResults = await analyzeRepository(node.children)

      results.push(...childResults.results) // 👈 important fix

    }

  }

  // ✅ aggregate data
  let totalFunctions = 0
  let totalExports = 0

  for (const file of results) {
    totalFunctions += file.functions?.length || 0
    totalExports += file.exports?.length || 0
  }

  return {
    totalFiles: results.length,
    totalFunctions,
    totalExports,
    filesAnalyzed: results.length,
    results
  }
}