import { Plus, X } from "lucide-react"
import { useState, type SyntheticEvent } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toastApiError } from "@/lib/api"
import { useFormKnownFields } from "@/lib/form-fields"
import { formatRelativeTime } from "@/lib/format"
import { usePublishStreamSchema, type SchemaVersion } from "@/lib/queries/streams"
import { cn } from "@/lib/utils"

type FieldType = "string" | "number" | "boolean" | "other"

type Field = {
  readonly name: string
  readonly type: FieldType
  readonly required: boolean
  /** The property schema as it was published, so untouched fields round-trip byte-for-byte
   * (formats, enums, descriptions) instead of being flattened to `{ type }`. */
  readonly original?: Readonly<Record<string, unknown>>
}

const TYPE_LABEL: Record<FieldType, string> = {
  string: "Text",
  number: "Number",
  boolean: "Yes / no",
  other: "As published",
}

function typeOf(property: Readonly<Record<string, unknown>> | undefined): FieldType {
  const type = property?.["type"]
  if (type === "string" || type === "number" || type === "boolean") return type
  if (type === "integer") return "number"
  return "other"
}

/** Postgres' jsonb doesn't keep key order, so fields follow `ui[name].order` when the schema
 * carries UI hints and fall back to the stored order otherwise. */
function fieldsFromSchema(
  jsonSchema: Readonly<Record<string, unknown>> | undefined,
  ui: Readonly<Record<string, unknown>> | undefined,
): Field[] {
  const properties = (jsonSchema?.["properties"] ?? {}) as Readonly<Record<string, Readonly<Record<string, unknown>>>>
  const required = new Set((jsonSchema?.["required"] as readonly string[] | undefined) ?? [])
  const orderOf = (name: string): number => {
    const order = (ui?.[name] as { order?: unknown } | undefined)?.order
    return typeof order === "number" ? order : Number.MAX_SAFE_INTEGER
  }
  return Object.entries(properties)
    .map(([name, property], index) => ({ name, type: typeOf(property), required: required.has(name), original: property, index }))
    .sort((a, b) => orderOf(a.name) - orderOf(b.name) || a.index - b.index)
    .map(({ name, type, required, original }) => ({ name, type, required, original }))
}

function buildSchema(fields: readonly Field[], previous: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> {
  const properties = Object.fromEntries(
    fields.map((field) => {
      const keepOriginal = field.original !== undefined && (field.type === "other" || typeOf(field.original) === field.type)
      return [field.name, keepOriginal ? field.original : { type: field.type }]
    }),
  )
  return {
    $schema: previous?.["$schema"] ?? "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties,
    required: fields.filter((f) => f.required).map((f) => f.name),
    additionalProperties: previous?.["additionalProperties"] ?? true,
  }
}

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/u

/**
 * The bag's shape — the fields every delivery from it carries — as a list people can edit
 * without seeing JSON Schema. Publishing always creates the next version (schemas are
 * immutable, Golden rule 5); attached forms are re-checked against it by the server.
 *
 * Mount with `key={schema.version}` so a fresh publish resets the draft.
 */
export function ShapeEditor({
  bagId,
  schema,
  forms,
  onPublished,
}: {
  readonly bagId: string
  readonly schema: SchemaVersion | undefined
  /** Forms that can seed an empty shape ("start from this form's fields"). */
  readonly forms: readonly { readonly id: string; readonly name: string }[]
  readonly onPublished?: () => void
}) {
  const previous = schema?.json_schema as Readonly<Record<string, unknown>> | undefined
  const previousUi = schema?.ui as Readonly<Record<string, unknown>> | undefined
  const [fields, setFields] = useState<Field[]>(() => fieldsFromSchema(previous, previousUi))
  const [newName, setNewName] = useState("")
  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [changelog, setChangelog] = useState("")
  const publish = usePublishStreamSchema(bagId)

  const draft = buildSchema(fields, previous)
  const dirty = schema === undefined ? fields.length > 0 : JSON.stringify(draft) !== JSON.stringify(buildSchema(fieldsFromSchema(previous, previousUi), previous))
  const nextVersion = (schema?.version ?? 0) + 1

  function addField(event: SyntheticEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (name.length === 0) return
    if (!FIELD_NAME.test(name)) {
      setNameError("Letters, numbers, _ . - only, starting with a letter.")
      return
    }
    if (fields.some((f) => f.name === name)) {
      setNameError("That field is already in the shape.")
      return
    }
    setFields((current) => [...current, { name, type: "string", required: false }])
    setNewName("")
    setNameError(undefined)
  }

  function update(name: string, patch: Partial<Field>) {
    setFields((current) => current.map((f) => (f.name === name ? { ...f, ...patch } : f)))
  }

  async function publishShape() {
    try {
      const keptUi =
        previousUi === undefined
          ? undefined
          : Object.fromEntries(Object.entries(previousUi).filter(([name]) => fields.some((f) => f.name === name)))
      const result = await publish.mutateAsync({
        json_schema: draft,
        ...(keptUi === undefined ? {} : { ui: keptUi }),
        changelog: changelog.trim().length > 0 ? changelog.trim() : `Version ${nextVersion} — edited in the dashboard.`,
      })
      const incomplete = result.mappings.filter((m) => m.mapping_status === "incomplete").length
      toast.success(`Version ${nextVersion} published.`, {
        description:
          incomplete > 0
            ? `${incomplete} attached ${incomplete === 1 ? "form has" : "forms have"} fields left to match — see Sources.`
            : undefined,
      })
      setChangelog("")
      onPublished?.()
    } catch (error) {
      toastApiError(error, "Couldn't publish the shape — try again.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {schema !== undefined && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Version {schema.version}</span>
          {schema.changelog !== undefined && <> · {schema.changelog.replace(/^Version \d+ — /u, "")}</>}
          {schema.created_at !== undefined && <> · {formatRelativeTime(schema.created_at)}</>}
        </p>
      )}

      {fields.length === 0 ? (
        <SeedFromForm forms={forms} onSeed={setFields} />
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/70 bg-card">
          {fields.map((field) => (
            <li key={field.name} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-sm">{field.name}</span>
              <Select
                value={field.type}
                onValueChange={(value) => {
                  update(field.name, { type: value as FieldType })
                }}
              >
                <SelectTrigger className="h-8 w-32" aria-label={`Type of ${field.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["string", "number", "boolean"] as const).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                  {field.type === "other" && <SelectItem value="other">{TYPE_LABEL.other}</SelectItem>}
                </SelectContent>
              </Select>
              <label className="flex h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                <Switch
                  checked={field.required}
                  onCheckedChange={(checked) => {
                    update(field.name, { required: checked })
                  }}
                  aria-label={`${field.name} required`}
                />
                <span className={cn("w-14", field.required && "text-foreground")}>{field.required ? "Required" : "Optional"}</span>
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${field.name}`}
                onClick={() => {
                  setFields((current) => current.filter((f) => f.name !== field.name))
                }}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addField} className="flex flex-col gap-1.5" noValidate>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setNameError(undefined)
            }}
            placeholder="new_field"
            aria-label="New field name"
            aria-invalid={nameError !== undefined}
            className="h-8 w-56 font-mono text-sm"
          />
          <Button type="submit" variant="outline" size="sm" disabled={newName.trim().length === 0} className="gap-1.5">
            <Plus className="size-3.5" />
            Add field
          </Button>
        </div>
        {nameError !== undefined && <p className="text-xs text-destructive">{nameError}</p>}
      </form>

      <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="shape-changelog" className="text-xs text-muted-foreground">
            What changed? <span className="font-normal">(optional — shown in the version history)</span>
          </Label>
          <Input
            id="shape-changelog"
            value={changelog}
            onChange={(e) => {
              setChangelog(e.target.value)
            }}
            placeholder="Added phone, made email required"
            className="h-8 max-w-md text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          {dirty && fields.length > 0 && (
            <Badge variant="warning" className="animate-in fade-in-0 duration-(--duration-quick)">
              Unpublished changes
            </Badge>
          )}
          <Button onClick={() => void publishShape()} disabled={!dirty || fields.length === 0 || publish.isPending}>
            {publish.isPending ? "Publishing…" : `Publish version ${nextVersion}`}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        Publishing never edits a version in place — it creates the next one, and every attached form is re-checked against it.
        Deliveries already sent keep the version they were made with.
      </p>
    </div>
  )
}

function SeedFromForm({
  forms,
  onSeed,
}: {
  readonly forms: readonly { readonly id: string; readonly name: string }[]
  readonly onSeed: (fields: Field[]) => void
}) {
  const [formId, setFormId] = useState<string | undefined>(undefined)
  const known = useFormKnownFields(formId)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border px-4 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No fields yet</p>
        <p className="text-sm text-muted-foreground text-pretty">
          Start from a form you already have — its fields become the shape — or add fields by hand below.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={formId ?? ""} onValueChange={setFormId}>
          <SelectTrigger className="h-8 w-64">
            <SelectValue placeholder="Start from a form…" />
          </SelectTrigger>
          <SelectContent>
            {forms.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formId !== undefined && !known.pending && known.fields.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onSeed(known.fields.map((name) => ({ name, type: "string", required: known.required.includes(name) })))
            }}
          >
            Use {known.fields.length === 1 ? "this field" : `these ${known.fields.length} fields`}
          </Button>
        )}
      </div>
      {formId !== undefined && !known.pending && (
        <div className="flex flex-wrap gap-1.5">
          {known.fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              That form has no fields yet — it hasn't received a submission and has no published schema. Send it one test
              submission first, or add fields by hand.
            </p>
          ) : (
            known.fields.map((name) => (
              <Badge key={name} variant="muted" className="font-mono">
                {name}
              </Badge>
            ))
          )}
        </div>
      )}
    </div>
  )
}
