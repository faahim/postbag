import { createFileRoute, Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { CreateFormDialog } from "@/components/create-form-dialog"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCount, formatRelativeTime } from "@/lib/format"
import { useForms } from "@/lib/queries/forms"

const searchSchema = z.object({ new: z.boolean().optional() })

export const Route = createFileRoute("/_app/forms/")({
  component: FormsIndexRoute,
  validateSearch: searchSchema,
})

function FormsIndexRoute() {
  const search = Route.useSearch()
  const forms = useForms()
  const [createOpen, setCreateOpen] = useState(search.new === true)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Forms</h1>
          <p className="text-sm text-muted-foreground">Every endpoint receiving submissions in this workspace.</p>
        </div>
        <Button
          onClick={() => {
            setCreateOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          New form
        </Button>
      </div>

      {forms.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : forms.data === undefined || forms.data.data.length === 0 ? (
        <EmptyState
          status="pending"
          title="No forms yet"
          description="A form is an endpoint your site posts to. Create one and you'll have a working URL immediately."
          action={
            <Button
              onClick={() => {
                setCreateOpen(true)
              }}
            >
              Create your first form
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Submissions</TableHead>
              <TableHead className="text-right">Last submission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forms.data.data.map((form) => (
              <TableRow key={form.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link to="/forms/$formId" params={{ formId: form.id }} className="block">
                    {form.name}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{form.id}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={form.status === "active" ? "success" : "muted"}>{form.status}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(form.counts.submissions)}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {form.counts.last_submission_at !== null ? formatRelativeTime(form.counts.last_submission_at) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
