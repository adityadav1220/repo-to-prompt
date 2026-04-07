declare module "@babel/traverse" {
  import type { Node } from "@babel/types"

  type Visitor = Record<string, (path: { node: Node }) => void>

  function traverse(
    parent: unknown,
    opts: Visitor,
    scope?: unknown,
    state?: unknown,
    parentPath?: unknown
  ): void

  export default traverse
}
