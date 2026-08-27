import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronRight, Plus } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { z } from "zod"

import { CreateFormDialog } from "@/components/create-form-dialog"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
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
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(search.new === true)

  return (
    <div className="page-enter flex flex-col gap-8">
      <PageHeader
        title="Forms"
        description="Every Form gives your site somewhere to post. Submissions land here first."
        actions={
          <Button
            onClick={() => {
              setCreateOpen(true)
            }}
          >
            <Plus />
            New Form
          </Button>
        }
      />

      {forms.isLoading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : forms.data === undefined || forms.data.data.length === 0 ? (
        <EmptyState
          title="Your first Form starts here"
          description="A Form is a URL your site posts to. Create one and the URL works right away — your site can start posting before the kettle boils."
          action={
            <Button
              size="lg"
              onClick={() => {
                setCreateOpen(true)
              }}
            >
              Create your first Form
            </Button>
          }
        />
      ) : (
        <div className="list-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Submissions</TableHead>
                <TableHead className="text-right">Last submission</TableHead>
                <TableHead aria-hidden className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.data.data.map((form, i) => (
                <TableRow
                  key={form.id}
                  className="row-enter group cursor-pointer"
                  style={{ "--row-index": i } as CSSProperties}
                  onClick={() => {
                    void navigate({ to: "/forms/$formId", params: { formId: form.id } })
                  }}
                >
                  <TableCell className="py-4">
                    <Link to="/forms/$formId" params={{ formId: form.id }} className="flex flex-col gap-1 outline-none">
                      <span className="text-[15px] font-medium">{form.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{form.id}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={form.status === "active" ? "success" : "muted"}>{form.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-[15px] tabular-nums">{formatCount(form.counts.submissions)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                    {form.counts.last_submission_at !== null ? formatRelativeTime(form.counts.last_submission_at) : "—"}
                  </TableCell>
                  <TableCell className="w-10 pr-4 pl-0">
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-muted-foreground/50 transition-[transform,color] duration-(--duration-quick) ease-(--ease-smooth-out) group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
