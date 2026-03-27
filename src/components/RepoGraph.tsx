"use client"

import React, { useEffect, useState } from "react"
import ReactFlow, { Node, Edge, Background, Controls, Position } from "reactflow"
import dagre from "dagre"
import "reactflow/dist/style.css"

interface RepoGraphProps {
  files: any[]
  edges: { source: string; target: string }[]
}

const nodeWidth = 180
const nodeHeight = 50

export default function RepoGraph({ files, edges }: RepoGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [reactEdges, setReactEdges] = useState<Edge[]>([])

  useEffect(() => {
    if (!files || !edges) return

    // map files to nodes with colors
    const mappedNodes: Node[] = files.map(file => {
      let bg = "#888" // default grey
      if (file.filePath.endsWith(".tsx") || file.filePath.endsWith(".jsx")) bg = "#4B9CE2" // UI
      else if (file.filePath.endsWith(".ts") || file.filePath.endsWith(".js")) bg = "#4CAF50" // logic
      else if (file.filePath.endsWith(".png") || file.filePath.endsWith(".jpg")) bg = "#F7DC6F" // assets

      return {
        id: file.filePath,
        data: { label: file.filePath.split("/").pop() },
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width: nodeWidth,
          height: nodeHeight,
          backgroundColor: bg,
          color: "#fff",
          borderRadius: 8,
          padding: 10,
          fontSize: 12
        }
      }
    })

    // map edges with unique id
    const mappedEdges: Edge[] = edges.map(e => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#555" }
    }))

    // use dagre layout
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: "TB", marginx: 50, marginy: 50 })
    g.setDefaultEdgeLabel(() => ({}))

    mappedNodes.forEach(node => g.setNode(node.id, { width: nodeWidth, height: nodeHeight }))
    mappedEdges.forEach(edge => g.setEdge(edge.source, edge.target))

    dagre.layout(g)

    const laidOutNodes = mappedNodes.map(node => {
      const { x, y } = g.node(node.id)
      return { ...node, position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 } }
    })

    setNodes(laidOutNodes)
    setReactEdges(mappedEdges)
  }, [files, edges])

  return (
    <div style={{ width: "100%", height: "600px", border: "1px solid #ccc" }}>
      <ReactFlow nodes={nodes} edges={reactEdges} fitView>
        <Background color="#aaa" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  )
}