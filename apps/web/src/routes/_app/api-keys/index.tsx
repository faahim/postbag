import { createFileRoute } from "@tanstack/react-router"
import { Plus, Trash2 } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { toast } from "sonner"

import { CopyButton } from "@/components/copy-button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/lib/format"
import { useApiKeys, useCreateApiKey, useDeleteApiKey, type ApiKeyScope } from "@/lib/queries/api-keys"

const SCOPES: readonly ApiKeyScope[] = ["read", "submit", "manage"]

export const Route = createFileRoute("/_app/api-keys/")({
  component: ApiKeysRoute,
})

function ApiKeysRoute() {
  const apiKeys = useApiKeys()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="page-enter flex flex-col gap-8">
      <PageHeader
        title="API keys"
        description="Everything the dashboard can do, an agent can do with one of these."
        actions={
          <Button
            onClick={() => {
              setCreateOpen(true)
            }}
          >
            <Plus />
            New key
          </Button>
        }
      />

      {apiKeys.isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : apiKeys.data === undefined || apiKeys.data.length === 0 ? (
        <EmptyState
          title="No keys cut yet"
          description="An API key lets a script or an agent run this workspace — Forms, Submissions, Destinations, the lot — without ever opening the dashboard."
          action={
            <Button
              size="lg"
              onClick={() => {
                setCreateOpen(true)
              }}
            >
              Create a key
            </Button>
          }
        />
      ) : (
        <div className="list-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.data.map((key, i) => (
                <ApiKeyRow key={key.id} apiKey={key} index={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateApiKeyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function ApiKeyRow({
  apiKey,
  index,
}: {
  readonly apiKey: { readonly id: string; readonly name: string | null; readonly prefix: string | null; readonly scopes: readonly ApiKeyScope[]; readonly created_at: string }
  readonly index: number
}) {
  const deleteKey = useDeleteApiKey()
  return (
    <TableRow className="row-enter" style={{ "--row-index": index } as CSSProperties}>
      <TableCell className="text-[15px] font-medium">{apiKey.name ?? "Untitled key"}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{apiKey.prefix ?? "—"}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {apiKey.scopes.map((s) => (
            <Badge key={s} variant="outline">
              {s}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">{formatDateTime(apiKey.created_at)}</TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Revoke key"
          onClick={() => {
            deleteKey.mutate(apiKey.id, {
              onSuccess: () => {
                toast.success("Key revoked.")
              },
            })
          }}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function CreateApiKeyDialog({ open, onOpenChange }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const createKey = useCreateApiKey()
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<Set<ApiKeyScope>>(new Set(["read", "submit"]))
  const [created, setCreated] = useState<{ readonly key: string } | null>(null)

  function toggle(scope: ApiKeyScope) {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return next
    })
  }

  async function create() {
    const result = await createKey.mutateAsync({ ...(name !== "" ? { name } : {}), scopes: [...scopes] })
    setCreated({ key: result.key })
  }

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setCreated(null)
      setName("")
      setScopes(new Set(["read", "submit"]))
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created !== null ? "Key created" : "New API key"}</DialogTitle>
          <DialogDescription>
            {created !== null ? "Copy it now — you won't be able to see it again." : "Choose what this key can do."}
          </DialogDescription>
        </DialogHeader>

        {created !== null ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2.5">
              <code className="flex-1 truncate font-mono text-sm">{created.key}</code>
              <CopyButton value={created.key} />
            </div>
            <Button
              onClick={() => {
                close(false)
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-name">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="key-name" placeholder="CI pipeline" value={name} onChange={(e) => { setName(e.target.value) }} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Scopes</Label>
              {SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={scopes.has(scope)} onCheckedChange={() => { toggle(scope) }} />
                  {scope}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => void create()} disabled={createKey.isPending || scopes.size === 0}>
                {createKey.isPending ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
