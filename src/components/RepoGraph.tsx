"use client"

import React, { useMemo, useEffect, useState } from "react"
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  Position,
  ReactFlowProvider,
  ReactFlowInstance
} from "reactflow"
import dagre from "dagre"
import "reactflow/dist/style.css"

type FlowDirection = "upstream" | "downstream" | "bidirectional"

interface FileFlowAnalyzerProps {
  files: { filePath: string }[]
  edges: { source: string; target: string }[]
  selectedFile: string | null
  direction: FlowDirection
}

const nodeWidth = 200
const nodeHeight = 56

function buildSubgraph(
  root: string,
  edges: { source: string; target: string }[],
  direction: FlowDirection
) {
  const forward = new Map<string, Set<string>>()
  const backward = new Map<string, Set<string>>()

  for (const e of edges) {
    if (!forward.has(e.source)) forward.set(e.source, new Set())
    if (!backward.has(e.target)) backward.set(e.target, new Set())
    forward.get(e.source)!.add(e.target)
    backward.get(e.target)!.add(e.source)
  }

  const nodes = new Set<string>([root])
  const subEdges: { source: string; target: string }[] = []

  const visit = (
    start: string,
    neighborMap: Map<string, Set<string>>,
    isForward: boolean
  ) => {
    const queue: { id: string; depth: number }[] = [{ id: start, depth: 0 }]
    const visited = new Set<string>([start])

    while (queue.length) {
      const { id, depth } = queue.shift()!
      if (depth >= 5) continue

      const neighbors = neighborMap.get(id)
      if (!neighbors) continue

      for (const n of neighbors) {
        nodes.add(n)
        subEdges.push(
          isForward ? { source: id, target: n } : { source: n, target: id }
        )

        if (!visited.has(n)) {
          visited.add(n)
          queue.push({ id: n, depth: depth + 1 })
        }
      }
    }
  }

  if (direction === "downstream" || direction === "bidirectional") {
    visit(root, forward, true)
  }

  if (direction === "upstream" || direction === "bidirectional") {
    visit(root, backward, false)
  }

  return { nodeIds: nodes, edges: subEdges }
}

export default function FileFlowAnalyzer({
  files,
  edges,
  selectedFile,
  direction
}: FileFlowAnalyzerProps) {
  const { nodes, reactEdges } = useMemo(() => {
    if (!selectedFile) return { nodes: [] as Node[], reactEdges: [] as Edge[] }

    const { nodeIds, edges: subEdges } = buildSubgraph(
      selectedFile,
      edges,
      direction
    )

    const relevantFiles = files.filter((f) => nodeIds.has(f.filePath))

    const mappedNodes: Node[] = relevantFiles.map((file) => {
      const isRoot = file.filePath === selectedFile

      const fp = file.filePath.toLowerCase()
      let bg = "#1f2933"
      if (fp.endsWith(".tsx") || fp.endsWith(".jsx")) {
        bg = "#2563eb"
      } else if (fp.endsWith(".ts") || fp.endsWith(".js") || fp.endsWith(".mjs") || fp.endsWith(".cjs")) {
        bg = "#059669"
      } else if (fp.endsWith(".py") || fp.endsWith(".pyw")) {
        bg = "#7c3aed"
      } else if (fp.endsWith(".go")) {
        bg = "#0891b2"
      } else if (fp.endsWith(".rs")) {
        bg = "#b45309"
      } else if (fp.endsWith(".java") || fp.endsWith(".kt") || fp.endsWith(".kts")) {
        bg = "#db2777"
      } else if (fp.endsWith(".rb")) {
        bg = "#dc2626"
      } else if (fp.endsWith(".php")) {
        bg = "#6366f1"
      } else if (fp.endsWith(".c") || fp.endsWith(".h") || fp.endsWith(".cpp") || fp.endsWith(".hpp")) {
        bg = "#475569"
      }

      return {
        id: file.filePath,
        data: {
          label: file.filePath.split("/").pop()
        },
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width: nodeWidth,
          height: nodeHeight,
          backgroundColor: isRoot ? "#f97316" : bg,
          color: "#e5e7eb",
          borderRadius: 10,
          padding: 10,
          fontSize: 12,
          border: isRoot
            ? "2px solid #fde68a"
            : "1px solid rgba(148,163,184,0.6)",
          boxShadow: "0 10px 25px rgba(15,23,42,0.6)"
        }
      }
    })

    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: "LR", marginx: 40, marginy: 40 })
    g.setDefaultEdgeLabel(() => ({}))

    mappedNodes.forEach((node) =>
      g.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    )
    subEdges.forEach((edge) => g.setEdge(edge.source, edge.target))

    dagre.layout(g)

    const laidOutNodes = mappedNodes.map((node) => {
      const { x, y } = g.node(node.id)
      return {
        ...node,
        position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 }
      }
    })

    const mappedEdges: Edge[] = subEdges.map((e) => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#64748b" }
    }))

    return { nodes: laidOutNodes, reactEdges: mappedEdges }
  }, [files, edges, selectedFile, direction])

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Select a file to visualize its flow.
      </div>
    )
  }

  if (!nodes.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        <span>No dependency data for this file.</span>
        <span className="text-xs text-slate-400">
          Try another direction or choose a different file.
        </span>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ReactFlowProvider>
        <FlowCanvas nodes={nodes} edges={reactEdges} />
      </ReactFlowProvider>
    </div>
  )
}

function FlowCanvas({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const [instance, setInstance] = useState<ReactFlowInstance | null>(null)

  useEffect(() => {
    if (!instance || !nodes.length) return
    // Defer slightly so React Flow can finish layout when switching files/directions
    const id = window.setTimeout(() => {
      instance.fitView({ padding: 0.2, duration: 400 })
    }, 30)
    return () => window.clearTimeout(id)
  }, [instance, nodes, edges, nodes.length])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onInit={setInstance}
      fitView
      fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
      minZoom={0.2}
      maxZoom={1.5}
    >
      <Background color="#e5e7eb" gap={24} />
      <Controls />
    </ReactFlow>
  )
}