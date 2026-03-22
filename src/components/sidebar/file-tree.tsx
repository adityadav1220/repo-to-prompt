"use client"

import React, { useState, useMemo, memo, useCallback } from "react"
import { FileNode } from "@/types/file-node"
import { ChevronDown, ChevronRight, Folder, File } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

function flattenTree(
  nodes: FileNode[],
  map = new Map<string, FileNode>(),
  parentMap = new Map<string, string>(),
  parentId?: string
) {
  for (const node of nodes) {
    map.set(node.id, node)

    if (parentId) parentMap.set(node.id, parentId)

    if (node.children) {
      flattenTree(node.children, map, parentMap, node.id)
    }
  }

  return { map, parentMap }
}

const TreeNode = memo(
  ({
    node,
    selected,
    toggle,
    indeterminate
  }: {
    node: FileNode
    selected: Set<string>
    toggle: (node: FileNode, val: boolean) => void
    indeterminate: Set<string>
  }) => {
    const [open, setOpen] = useState(false)

    const isChecked = selected.has(node.id)
    const isIndeterminate = indeterminate.has(node.id)

    return (
      <div className="select-none">

        <div className="flex items-center gap-2 py-1 px-1 text-sm hover:bg-slate-100 rounded group transition-colors">

          <div className="w-4 h-4 flex items-center justify-center">
            {node.type === "folder" && (
              <button
                onClick={() => setOpen(!open)}
                className="text-slate-500 hover:text-slate-900"
              >
                {open ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            )}
          </div>

          <Checkbox
            checked={isIndeterminate ? "indeterminate" : isChecked}
            onCheckedChange={(val) => toggle(node, val === true)}
          />

          <div
            className="flex items-center gap-2 cursor-pointer flex-1"
            onClick={() =>
              node.type === "folder"
                ? setOpen(!open)
                : toggle(node, !isChecked)
            }
          >
            {node.type === "folder" ? (
              <Folder size={16} className="text-blue-500 fill-blue-50" />
            ) : (
              <File size={16} className="text-slate-400" />
            )}

            <span className="truncate max-w-[180px]">{node.name}</span>
          </div>
        </div>

        {open && node.children && (
          <div className="pl-4 ml-2 border-l border-slate-200">
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                selected={selected}
                toggle={toggle}
                indeterminate={indeterminate}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
)

export default function FileTree({
  files,
  selected,
  setSelected
}: {
  files: FileNode[]
  selected: Set<string>
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
}) {

  const { nodeMap, parentMap } = useMemo(() => {
    const { map, parentMap } = flattenTree(files)
    return { nodeMap: map, parentMap }
  }, [files])

  const indeterminate = useMemo(() => {
    const indet = new Set<string>()

    for (const id of selected) {
      let curr = parentMap.get(id)

      while (curr) {
        if (!selected.has(curr)) indet.add(curr)

        curr = parentMap.get(curr)
      }
    }

    return indet
  }, [selected, parentMap])

  const toggle = useCallback(
    (node: FileNode, checked: boolean) => {

      setSelected((prev) => {
        const next = new Set(prev)

        const applyRecursive = (n: FileNode) => {
          checked ? next.add(n.id) : next.delete(n.id)

          n.children?.forEach(applyRecursive)
        }

        applyRecursive(node)

        let parentId = parentMap.get(node.id)

        while (parentId) {
          const parentNode = nodeMap.get(parentId)

          const allChildrenChecked =
            parentNode?.children?.every((c) => next.has(c.id))

          allChildrenChecked
            ? next.add(parentId)
            : next.delete(parentId)

          parentId = parentMap.get(parentId)
        }

        return next
      })
    },
    [nodeMap, parentMap, setSelected]
  )

  const fileCount = useMemo(() => {
    return Array.from(selected).filter(
      (id) => nodeMap.get(id)?.type === "file"
    ).length
  }, [selected, nodeMap])

  return (
    <div className="flex flex-col h-full">

      <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-50 z-10 py-2">
        <h3 className="font-bold text-slate-800">Files</h3>

        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
          {fileCount} SELECTED
        </span>
      </div>

      <div className="overflow-y-auto pr-2 custom-scrollbar">

        {files.map((n) => (
          <TreeNode
            key={n.id}
            node={n}
            selected={selected}
            toggle={toggle}
            indeterminate={indeterminate}
          />
        ))}

      </div>

    </div>
  )
}