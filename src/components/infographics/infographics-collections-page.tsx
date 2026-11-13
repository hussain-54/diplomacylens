import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  GripVertical,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CmsAlert,
  CmsEmptyState,
  CmsPageHeader,
  CmsPanel,
  cmsButton,
  cmsInput,
  cmsSecondaryButton,
} from "@/components/cms";
import { Field } from "@/components/cms/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getCollectionItems,
  listInfographicCollectionsAdmin,
  listInfographicsAdmin,
  reorderCollectionItems,
  upsertInfographicCollection,
  type Infographic,
  type InfographicCollection,
} from "@/lib/infographics.functions";
import { cn } from "@/lib/utils";

type CollectionItemRow = {
  infographic_id: string;
  sort_order: number;
  infographic: Infographic | null;
};

const NEW_ID = "__new__";

const DEFAULT_FORM = {
  title: "",
  description: "",
  cover_image_url: "",
  status: "draft",
  is_featured: false,
};

export function InfographicsCollectionsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [addPickerId, setAddPickerId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<InfographicCollection | null>(null);

  const collectionsQ = useQuery({
    queryKey: ["infographic-collections-admin"],
    queryFn: listInfographicCollectionsAdmin,
  });

  const isNew = selectedId === NEW_ID;
  const selectedCollection = collectionsQ.data?.find((c) => c.id === selectedId) ?? null;

  const itemsQ = useQuery({
    queryKey: ["infographic-collection-items", selectedId],
    queryFn: () => getCollectionItems(selectedId!),
    enabled: !!selectedId && !isNew,
  });

  const pickerQ = useQuery({
    queryKey: ["infographics-picker"],
    queryFn: () => listInfographicsAdmin({ archived: "exclude", pageSize: 100 }),
  });

  useEffect(() => {
    if (isNew) {
      setForm(DEFAULT_FORM);
      setItemIds([]);
      return;
    }
    if (selectedCollection) {
      setForm({
        title: selectedCollection.title,
        description: selectedCollection.description ?? "",
        cover_image_url: selectedCollection.cover_image_url ?? "",
        status: selectedCollection.status,
        is_featured: selectedCollection.is_featured,
      });
    }
  }, [selectedCollection, isNew]);

  useEffect(() => {
    if (itemsQ.data) {
      const rows = itemsQ.data as unknown as CollectionItemRow[];
      setItemIds(rows.map((r) => r.infographic_id));
    }
  }, [itemsQ.data]);

  const itemsById = useMemo(() => {
    const map = new Map<string, Infographic>();
    for (const row of (itemsQ.data as unknown as CollectionItemRow[]) ?? []) {
      if (row.infographic) map.set(row.infographic_id, row.infographic);
    }
    for (const row of pickerQ.data?.rows ?? []) {
      if (!map.has(row.id)) map.set(row.id, row);
    }
    return map;
  }, [itemsQ.data, pickerQ.data]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["infographic-collections-admin"] });
    void qc.invalidateQueries({ queryKey: ["infographic-collection-items"] });
  };

  const save = useMutation({
    mutationFn: () =>
      upsertInfographicCollection({
        data: {
          id: isNew ? undefined : selectedId!,
          title: form.title,
          description: form.description || null,
          cover_image_url: form.cover_image_url || null,
          status: form.status,
          is_featured: form.is_featured,
          infographic_ids: itemIds,
        },
      }),
    onSuccess: (row) => {
      toast.success(isNew ? "Collection created" : "Collection updated");
      setSelectedId(row.id);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: () =>
      reorderCollectionItems({ data: { collection_id: selectedId!, infographic_ids: itemIds } }),
    onSuccess: () => {
      toast.success("Order saved");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () =>
      upsertInfographicCollection({
        data: {
          id: pendingDelete!.id,
          title: pendingDelete!.title,
          status: "archived",
        },
      }),
    onSuccess: () => {
      toast.success("Collection archived");
      setPendingDelete(null);
      if (selectedId === pendingDelete?.id) setSelectedId(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveItem = (from: number, to: number) => {
    setItemIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const availableToAdd = (pickerQ.data?.rows ?? []).filter((row) => !itemIds.includes(row.id));

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Collections"
        description="Group infographics into curated collections for the public site."
        actions={
          <button
            type="button"
            className={cmsButton}
            onClick={() => {
              setSelectedId(NEW_ID);
            }}
          >
            <Plus className="h-4 w-4" /> New collection
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <CmsPanel className="overflow-hidden">
          <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
            {(collectionsQ.data ?? []).map((collection) => (
              <li key={collection.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(collection.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left cms-transition hover:bg-accent/60",
                    selectedId === collection.id && "bg-accent",
                  )}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                    {collection.cover_image_url ? (
                      <img
                        src={collection.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{collection.title}</div>
                    <div className="text-[10px] capitalize text-muted-foreground">
                      {collection.status}
                    </div>
                  </div>
                </button>
              </li>
            ))}
            {!collectionsQ.isLoading && (collectionsQ.data?.length ?? 0) === 0 ? (
              <li>
                <CmsEmptyState
                  title="No collections"
                  description="Create a collection to group infographics."
                />
              </li>
            ) : null}
          </ul>
        </CmsPanel>

        <div className="space-y-4">
          {!selectedId ? (
            <CmsPanel>
              <CmsEmptyState
                title="Select a collection"
                description="Choose a collection from the list, or create a new one."
              />
            </CmsPanel>
          ) : (
            <>
              {save.error ? <CmsAlert>{save.error.message}</CmsAlert> : null}
              {reorder.error ? <CmsAlert>{reorder.error.message}</CmsAlert> : null}
              <CmsPanel
                title={isNew ? "New collection" : "Edit collection"}
                description="Title, description, cover art, and status"
              >
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  <Field label="Title" hint="Required">
                    <input
                      className={cmsInput}
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={cmsInput}
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </Field>
                  <div className="lg:col-span-2">
                    <Field label="Description">
                      <textarea
                        className={`${cmsInput} h-auto py-2`}
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Cover image URL">
                    <input
                      className={cmsInput}
                      value={form.cover_image_url}
                      onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                    />
                  </Field>
                  <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
                    <span className="text-xs font-semibold">Featured collection</span>
                    <input
                      type="checkbox"
                      checked={form.is_featured}
                      onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 p-4">
                  {!isNew ? (
                    <button
                      type="button"
                      className="mr-auto flex h-9 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold text-cat-rose hover:bg-cat-rose/10"
                      onClick={() => selectedCollection && setPendingDelete(selectedCollection)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Archive collection
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={cmsButton}
                    disabled={save.isPending || !form.title.trim()}
                    onClick={() => save.mutate()}
                  >
                    {save.isPending ? "Saving…" : isNew ? "Create collection" : "Save changes"}
                  </button>
                </div>
              </CmsPanel>

              {!isNew ? (
                <CmsPanel
                  title="Collection items"
                  description="Drag to reorder, or use the arrows. Save order to persist."
                  action={
                    <button
                      type="button"
                      className={cmsSecondaryButton}
                      disabled={reorder.isPending || itemIds.length === 0}
                      onClick={() => reorder.mutate()}
                    >
                      {reorder.isPending ? "Saving…" : "Save order"}
                    </button>
                  }
                >
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <select
                        className={cmsInput}
                        value={addPickerId}
                        onChange={(e) => setAddPickerId(e.target.value)}
                      >
                        <option value="">Add an infographic…</option>
                        {availableToAdd.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={cmsSecondaryButton}
                        disabled={!addPickerId}
                        onClick={() => {
                          if (!addPickerId) return;
                          setItemIds((prev) => [...prev, addPickerId]);
                          setAddPickerId("");
                        }}
                      >
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </div>

                    {itemIds.length === 0 ? (
                      <CmsEmptyState
                        title="No items yet"
                        description="Add infographics to this collection above."
                      />
                    ) : (
                      <ul className="space-y-2">
                        {itemIds.map((id, index) => {
                          const item = itemsById.get(id);
                          return (
                            <li
                              key={id}
                              draggable
                              onDragStart={() => setDragIndex(index)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (dragIndex !== null && dragIndex !== index)
                                  moveItem(dragIndex, index);
                                setDragIndex(null);
                              }}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border border-border/70 bg-background p-2.5",
                                dragIndex === index && "opacity-60",
                              )}
                            >
                              <button
                                type="button"
                                className="cursor-grab p-1 text-muted-foreground hover:text-foreground"
                                aria-label="Drag to reorder"
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                                {item?.cover_image_url ? (
                                  <img
                                    src={item.cover_image_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center">
                                    <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 truncate text-sm font-medium">
                                {item?.title ?? "Untitled infographic"}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  disabled={index === 0}
                                  aria-label="Move up"
                                  onClick={() => moveItem(index, index - 1)}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                  disabled={index === itemIds.length - 1}
                                  aria-label="Move down"
                                  onClick={() => moveItem(index, index + 1)}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1 text-muted-foreground hover:text-cat-rose"
                                  aria-label="Remove from collection"
                                  onClick={() =>
                                    setItemIds((prev) => prev.filter((existing) => existing !== id))
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </CmsPanel>
              ) : null}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the collection from readers and clears its items. You can restore it later
              by editing it back to draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-cat-rose text-white hover:bg-cat-rose/90"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Archiving…" : "Archive collection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
