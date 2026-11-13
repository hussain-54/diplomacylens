import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CmsEmptyState,
  CmsPageSkeleton,
  CmsPanel,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { buildFolderTree, flattenFolderTree, type MediaFolder } from "@/lib/dam";
import { deleteMediaFolder, listMediaFolders, upsertMediaFolder } from "@/lib/media.functions";

export function MediaFoldersPage() {
  const qc = useQueryClient();
  const foldersQ = useQuery({ queryKey: ["media-folders"], queryFn: listMediaFolders });
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [editing, setEditing] = useState<MediaFolder | null>(null);

  const tree = useMemo(
    () => flattenFolderTree(buildFolderTree((foldersQ.data ?? []) as MediaFolder[])),
    [foldersQ.data],
  );

  const save = useMutation({
    mutationFn: () =>
      upsertMediaFolder({
        data: {
          id: editing?.id,
          name: (editing ? editing.name : name).trim(),
          parent_id: editing ? editing.parent_id : parentId || null,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Folder updated" : "Folder created");
      setName("");
      setParentId("");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["media-folders"] });
      void qc.invalidateQueries({ queryKey: ["media-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMediaFolder({ data: { id } }),
    onSuccess: () => {
      toast.success("Folder deleted");
      void qc.invalidateQueries({ queryKey: ["media-folders"] });
      void qc.invalidateQueries({ queryKey: ["media-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (foldersQ.isLoading) return <CmsPageSkeleton metrics={4} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">Folders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize library assets. Nested folders are supported; delete requires an empty folder.
        </p>
      </div>

      <CmsPanel title={editing ? "Edit folder" : "Create folder"}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="text-muted-foreground">Name</span>
            <input
              className={`${cmsInput} mt-1`}
              value={editing ? editing.name : name}
              onChange={(e) =>
                editing ? setEditing({ ...editing, name: e.target.value }) : setName(e.target.value)
              }
              placeholder="Folder name"
            />
          </label>
          {!editing ? (
            <label className="block w-full text-sm sm:w-56">
              <span className="text-muted-foreground">Parent</span>
              <select
                className={`${cmsInput} mt-1`}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">Root</option>
                {tree.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {"—".repeat(folder.depth)} {folder.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className={cmsButton}
            disabled={save.isPending || !(editing ? editing.name.trim() : name.trim())}
            onClick={() => save.mutate()}
          >
            <FolderPlus className="h-4 w-4" />
            {editing ? "Save" : "Create"}
          </button>
          {editing ? (
            <button type="button" className={cmsSecondaryButton} onClick={() => setEditing(null)}>
              Cancel
            </button>
          ) : null}
        </div>
      </CmsPanel>

      <CmsPanel title="Folder tree" description={`${tree.length} folders`}>
        {!tree.length ? (
          <CmsEmptyState
            title="No folders yet"
            description="Create a folder to organize uploads."
          />
        ) : (
          <ul className="divide-y divide-border">
            {tree.map((folder) => (
              <li
                key={folder.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
                style={{ paddingLeft: `${folder.depth * 16}px` }}
              >
                <span className="font-medium text-foreground">{folder.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label="Rename"
                    onClick={() => setEditing(folder)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                    onClick={() => {
                      if (confirm(`Delete folder “${folder.name}”?`)) remove.mutate(folder.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CmsPanel>
    </div>
  );
}
