import { Suspense } from "react"
import WorkspaceClient from "./WorkspaceClient"

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-3.5rem)] w-full" />}>
      <WorkspaceClient />
    </Suspense>
  )
}
