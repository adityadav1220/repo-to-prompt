declare module "dagre" {
  const dagre: {
    graphlib: {
      Graph: new () => {
        setGraph: (g: Record<string, unknown>) => void
        setDefaultEdgeLabel: (fn: () => unknown) => void
        setNode: (id: string, v: { width: number; height: number }) => void
        setEdge: (s: string, t: string) => void
        node: (id: string) => { x: number; y: number }
      }
    }
    layout: (g: unknown) => void
  }
  export default dagre
}
