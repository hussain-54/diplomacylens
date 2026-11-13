import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type Field = { key: string; label: string };

export function AdminMediaModulePage({
  title,
  queryKey,
  fields,
  listFn,
  upsertFn,
  deleteFn,
  newDefaults,
}: {
  title: string;
  queryKey: string;
  fields: Field[];
  listFn: () => Promise<Record<string, unknown>[]>;
  upsertFn: (data: { data: Record<string, unknown> }) => Promise<unknown>;
  deleteFn: (data: { data: { id: string } }) => Promise<unknown>;
  newDefaults: Record<string, unknown>;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [queryKey], queryFn: listFn });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });
  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) => upsertFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      setEditing(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
        <button
          type="button"
          onClick={() => setEditing({ ...newDefaults })}
          className="rounded-sm bg-navy px-3 py-2 text-xs uppercase tracking-widest text-navy-foreground"
        >
          New
        </button>
      </div>
      <div className="mt-4 overflow-hidden rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Meta</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((row) => (
              <tr key={String(row.id)} className="border-t border-border">
                <td className="p-3 font-serif">{String(row.title ?? "")}</td>
                <td className="p-3 text-muted-foreground">
                  {String(row.issue_number || row.category || row.host || row.duration || "—")}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="mr-3 text-xs text-navy hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => confirm("Delete?") && del.mutate(String(row.id))}
                    className="text-xs text-crimson hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.isLoading && !(q.data ?? []).length ? (
          <p className="border-t border-border p-4 text-sm text-muted-foreground">
            No items yet. Create one to populate the homepage module.
          </p>
        ) : null}
      </div>
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-sm bg-card p-6">
            <h2 className="font-serif text-2xl text-ink">{editing.id ? "Edit" : "New"} item</h2>
            <div className="mt-4 space-y-3">
              {fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="eyebrow text-muted-foreground">{field.label}</span>
                  <input
                    value={String(editing[field.key] ?? "")}
                    onChange={(e) => setEditing({ ...editing, [field.key]: e.target.value })}
                    className="mt-1 w-full rounded-sm border border-input px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-sm border border-input px-3 py-2 text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => save.mutate(editing)}
                className="rounded-sm bg-navy px-3 py-2 text-xs uppercase tracking-widest text-navy-foreground"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
