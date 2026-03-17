import ignore from "ignore"

export type FileNode = {
  id: string; // Full relative path
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
}

const DEFAULT_IGNORES = ["node_modules", ".next", "build", ".git", ".DS_Store"];

export async function getFilesRecursively(
  directoryHandle: FileSystemDirectoryHandle,
  parentPath = "",
  ig = ignore().add(DEFAULT_IGNORES)
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  
  // Check for .gitignore in CURRENT directory
  try {
    const gitignoreHandle = await directoryHandle.getFileHandle(".gitignore");
    const file = await gitignoreHandle.getFile();
    const text = await file.text();
    ig.add(text);
  } catch (e) { /* no gitignore here */ }

  for await (const entry of (directoryHandle as any).values()) {
    const relPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.name.startsWith(".") && entry.name !== ".gitignore") continue;
    if (ig.ignores(relPath)) continue;

    if (entry.kind === "file") {
      nodes.push({ id: relPath, name: entry.name, type: "file", handle: entry });
    } else {
      const children = await getFilesRecursively(entry, relPath, ig);
      nodes.push({ id: relPath, name: entry.name, type: "folder", children, handle: entry });
    }
  }

  // Sort: Folders first, then files alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "folder" ? -1 : 1;
  });
}

export async function pickFolderAndGetFiles(): Promise<FileNode[]> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error("Your browser does not support the File System Access API.");
  }
  const directoryHandle = await (window as any).showDirectoryPicker();
  return getFilesRecursively(directoryHandle);
}