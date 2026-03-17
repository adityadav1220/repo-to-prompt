export type FileNode = {
    id: string
    name: string
    type: "file" | "folder"
    children?: FileNode[]
  }
  
export const files: FileNode[] = [
    {
      id: "src",
      name: "src",
      type: "folder",
      children: [
        {
          id: "app",
          name: "app",
          type: "folder",
          children: [
            { id: "page", name: "page.tsx", type: "file" },
            { id: "layout", name: "layout.tsx", type: "file" }
          ]
        }
      ]
    },
    { id: "package", name: "package.json", type: "file" },
    { id: "readme", name: "README.md", type: "file" }
  ]