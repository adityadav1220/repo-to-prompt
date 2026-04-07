import ignore from "ignore"
import { FileNode } from "@/types/file-node"

const DEFAULT_IGNORES = [
  "node_modules",
  ".next",
  "build",
  ".git",
  ".DS_Store"
]

/*
-----------------------------------------
FILE TREE BUILDER
-----------------------------------------
*/

export async function getFilesRecursively(
  directoryHandle: FileSystemDirectoryHandle,
  parentPath = "",
  ig = ignore().add(DEFAULT_IGNORES)
): Promise<FileNode[]> {

  const nodes: FileNode[] = []

  // Check if .gitignore exists in this directory
  try {
    const gitignoreHandle = await directoryHandle.getFileHandle(".gitignore")
    const file = await gitignoreHandle.getFile()
    const text = await file.text()

    ig.add(text)
  } catch (e) {
    // No .gitignore in this folder
  }

  for await (const entry of (directoryHandle as any).values()) {

    const relPath = parentPath
      ? `${parentPath}/${entry.name}`
      : entry.name

    // ignore hidden files except .gitignore
    if (entry.name.startsWith(".") && entry.name !== ".gitignore") continue

    // ignore based on gitignore
    if (ig.ignores(relPath)) continue

    if (entry.kind === "file") {

      nodes.push({
        id: relPath,
        name: entry.name,
        type: "file",
        handle: entry
      })

    } else {

      const children = await getFilesRecursively(
        entry,
        relPath,
        ig
      )

      nodes.push({
        id: relPath,
        name: entry.name,
        type: "folder",
        children,
        handle: entry
      })

    }
  }

  // sort folders first then files
  return nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name)
    }
    return a.type === "folder" ? -1 : 1
  })
}

/*
-----------------------------------------
FOLDER PICKER
-----------------------------------------
*/

export async function pickFolderAndGetFiles(): Promise<FileNode[]> {

  if (!("showDirectoryPicker" in window)) {
    throw new Error(
      "Your browser does not support the File System Access API."
    )
  }

  const directoryHandle = await (window as any).showDirectoryPicker()

  return getFilesRecursively(directoryHandle)
}

/*
-----------------------------------------
FILE CONTENT RETRIEVAL
-----------------------------------------
*/

export async function getFileContent(
  handle: FileSystemFileHandle
): Promise<string> {

  try {
    const file = await handle.getFile()
    const text = await file.text()
    return text

  } catch (error) {

    console.error("Failed to read file:", error)
    return ""

  }
}

/*
-----------------------------------------
GET CONTENT FROM A FILENODE
-----------------------------------------
*/

export async function getFileNodeContent(
  node: FileNode
): Promise<string | null> {

  if (node.type !== "file" || !node.handle) {
    return null
  }

  const handle = node.handle as FileSystemFileHandle

  return getFileContent(handle)
}

/*
-----------------------------------------
READ ALL FILE CONTENTS (RECURSIVE)
-----------------------------------------
*/

export async function readAllFiles(
  nodes: FileNode[]
): Promise<void> {

  for (const node of nodes) {

    if (node.type === "file") {

      await getFileNodeContent(node)

    }

    if (node.type === "folder" && node.children) {

      await readAllFiles(node.children)

    }
  }
}