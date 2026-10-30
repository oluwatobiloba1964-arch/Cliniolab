'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImagePicker } from '@/components/ui/ImagePicker';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { Resource, ResourceCategory, ResourceKind, ResourcePricing } from '@/types';

interface PendingPurchase {
  id: string;
  resourceId: string;
  userId: string;
  proofImageUrl: string | null;
  status: string;
  createdAt: string;
  resourceTitle: string;
}

export default function AdminResourcesPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [pending, setPending] = useState<PendingPurchase[]>([]);

  const [kind, setKind] = useState<ResourceKind>('book');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [subjectTag, setSubjectTag] = useState('');
  const [pricing, setPricing] = useState<ResourcePricing>('free');
  const [priceNaira, setPriceNaira] = useState(0);
  const [driveLink, setDriveLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Categories (sub-categories under Book / Past Question Pack), e.g. "OSCE".
  const [categories, setCategories] = useState<ResourceCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Editing state — when set, the form above the list becomes "Edit resource"
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<ResourceKind>('book');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverImageUrl, setEditCoverImageUrl] = useState('');
  const [editInstitutionName, setEditInstitutionName] = useState('');
  const [editSubjectTag, setEditSubjectTag] = useState('');
  const [editPricing, setEditPricing] = useState<ResourcePricing>('free');
  const [editPriceNaira, setEditPriceNaira] = useState(0);
  const [editDriveLink, setEditDriveLink] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editAddingNewCategory, setEditAddingNewCategory] = useState(false);
  const [editNewCategoryName, setEditNewCategoryName] = useState('');

  function loadResources() {
    fetch('/api/admin/resources')
      .then((res) => res.json())
      .then((data) => setResources(data.resources ?? []));
  }

  function loadPending() {
    if (user?.role !== 'admin') return;
    fetch('/api/admin/purchases')
      .then((res) => res.json())
      .then((data) => setPending(data.purchases ?? []));
  }

  function loadCategories() {
    // Fetched unscoped (all kinds) and filtered client-side below, so
    // switching the kind dropdown doesn't require a re-fetch.
    fetch('/api/admin/resource-categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }

  useEffect(() => {
    loadResources();
    loadPending();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Categories are scoped to a kind — reset the selection when the kind
  // changes so a "book" category can't be attached to a "past_question_pack".
  useEffect(() => {
    setCategoryId('');
    setAddingNewCategory(false);
    setNewCategoryName('');
  }, [kind]);

  async function createResource() {
    setError(null);
    if (!title.trim() || !driveLink.trim()) {
      setError('Title and Google Drive link are required.');
      return;
    }
    if (pricing === 'paid' && priceNaira <= 0) {
      setError('Set a price for a paid resource.');
      return;
    }

    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        categoryId: addingNewCategory ? undefined : categoryId || undefined,
        newCategoryName: addingNewCategory ? newCategoryName.trim() || undefined : undefined,
        title,
        description: description || undefined,
        coverImageUrl: coverImageUrl || undefined,
        institutionName: kind === 'past_question_pack' ? institutionName || undefined : undefined,
        subjectTag: subjectTag || undefined,
        pricing,
        priceKobo: pricing === 'paid' ? Math.round(priceNaira * 100) : undefined,
        driveLink,
      }),
    });

    if (res.ok) {
      setTitle('');
      setDescription('');
      setCoverImageUrl('');
      setInstitutionName('');
      setSubjectTag('');
      setPriceNaira(0);
      setDriveLink('');
      setCategoryId('');
      setAddingNewCategory(false);
      setNewCategoryName('');
      loadResources();
      loadCategories(); // in case a new category was just created
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function startEdit(id: string) {
    setEditError(null);
    setEditLoading(true);
    setEditingId(id);
    try {
      const res = await fetch(`/api/admin/resources/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? 'Failed to load resource.');
        return;
      }
      const r = data.resource;
      setEditKind(r.kind);
      setEditTitle(r.title ?? '');
      setEditDescription(r.description ?? '');
      setEditCoverImageUrl(r.coverImageUrl ?? '');
      setEditInstitutionName(r.institutionName ?? '');
      setEditSubjectTag(r.subjectTag ?? '');
      setEditPricing(r.pricing);
      setEditPriceNaira(r.priceKobo ? r.priceKobo / 100 : 0);
      setEditDriveLink(r.driveLink ?? '');
      setEditCategoryId(r.categoryId ?? '');
      setEditAddingNewCategory(false);
      setEditNewCategoryName('');
    } finally {
      setEditLoading(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function onEditKindChange(newKind: ResourceKind) {
    setEditKind(newKind);
    // Categories are scoped to a kind — clear the selection when switching.
    setEditCategoryId('');
    setEditAddingNewCategory(false);
    setEditNewCategoryName('');
  }

  async function saveEdit() {
    if (!editingId) return;
    setEditError(null);
    if (!editTitle.trim() || !editDriveLink.trim()) {
      setEditError('Title and Google Drive link are required.');
      return;
    }
    if (editPricing === 'paid' && editPriceNaira <= 0) {
      setEditError('Set a price for a paid resource.');
      return;
    }

    const res = await fetch(`/api/admin/resources/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: editKind,
        categoryId: editAddingNewCategory ? undefined : editCategoryId || null,
        newCategoryName: editAddingNewCategory ? editNewCategoryName.trim() || undefined : undefined,
        title: editTitle,
        description: editDescription,
        coverImageUrl: editCoverImageUrl,
        institutionName: editKind === 'past_question_pack' ? editInstitutionName : '',
        subjectTag: editSubjectTag,
        pricing: editPricing,
        priceKobo: editPricing === 'paid' ? Math.round(editPriceNaira * 100) : undefined,
        driveLink: editDriveLink,
      }),
    });

    if (res.ok) {
      setEditingId(null);
      loadResources();
      loadCategories();
    } else {
      const data = await res.json();
      setEditError(data.error ?? 'Failed to save changes.');
    }
  }

  async function deleteResource(id: string) {
    if (!confirm('Delete this resource permanently?')) return;
    const res = await fetch(`/api/admin/resources/${id}`, { method: 'DELETE' });
    if (res.ok) loadResources();
  }

  async function confirmPurchase(id: string, status: 'confirmed' | 'rejected') {
    const res = await fetch(`/api/admin/purchases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) loadPending();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Books &amp; Past Questions</h1>

      <Card className="mt-6 space-y-3 p-5">
        <div className="grid grid-cols-2 gap-3">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ResourceKind)}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
          >
            <option value="book">Book / Slide</option>
            <option value="past_question_pack">Past Question Pack</option>
          </select>
          <select
            value={pricing}
            onChange={(e) => setPricing(e.target.value as ResourcePricing)}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={addingNewCategory ? '__new__' : categoryId}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                setCategoryId('');
                setAddingNewCategory(true);
              } else {
                setAddingNewCategory(false);
                setNewCategoryName('');
                setCategoryId(e.target.value);
              }
            }}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
          >
            <option value="">No category</option>
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            <option value="__new__">+ New category…</option>
          </select>
          {addingNewCategory && (
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={`New category name (under ${kind === 'book' ? 'Books' : 'Past Question Packs'})`}
              className="rounded-md border border-pulse-300 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
              autoFocus
            />
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        <ImagePicker value={coverImageUrl} onChange={setCoverImageUrl} purpose="resources" label="Cover image (optional, falls back to a default cover if left blank)" />
        {kind === 'past_question_pack' && (
          <input
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            placeholder="Institution name (e.g. UBTH School of Nursing)"
            className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        )}
        <input
          value={subjectTag}
          onChange={(e) => setSubjectTag(e.target.value)}
          placeholder="Subject tag (optional)"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
        {pricing === 'paid' && (
          <input
            type="number"
            min={0}
            value={priceNaira}
            onChange={(e) => setPriceNaira(Number(e.target.value))}
            placeholder="Price in Naira"
            className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
          />
        )}
        <input
          value={driveLink}
          onChange={(e) => setDriveLink(e.target.value)}
          placeholder="Google Drive link (never shown to users directly)"
          className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />

        {error && <p className="text-sm text-critical-500">{error}</p>}
        <Button size="sm" onClick={createResource}>Upload resource</Button>
      </Card>

      <h2 className="mt-8 font-display text-lg font-semibold text-ink-800">All resources</h2>
      <div className="mt-4 space-y-3">
        {resources.map((r) => (
          <div key={r.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-ink-800">{r.title}</p>
                <p className="text-xs text-ink-400">
                  {r.kind === 'past_question_pack' ? 'Past Question Pack' : 'Book'} · {r.pricing}
                  {r.categoryName ? ` · ${r.categoryName}` : ''}
                  {r.institutionName ? ` · ${r.institutionName}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => (editingId === r.id ? cancelEdit() : startEdit(r.id))}>
                  {editingId === r.id ? 'Cancel' : 'Edit'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => deleteResource(r.id)}>Delete</Button>
              </div>
            </Card>

            {editingId === r.id && (
              <Card className="mt-2 space-y-3 border border-pulse-200 p-5">
                {editLoading ? (
                  <p className="text-sm text-ink-400">Loading…</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={editKind}
                        onChange={(e) => onEditKindChange(e.target.value as ResourceKind)}
                        className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
                      >
                        <option value="book">Book / Slide</option>
                        <option value="past_question_pack">Past Question Pack</option>
                      </select>
                      <select
                        value={editPricing}
                        onChange={(e) => setEditPricing(e.target.value as ResourcePricing)}
                        className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
                      >
                        <option value="free">Free</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={editAddingNewCategory ? '__new__' : editCategoryId}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setEditCategoryId('');
                            setEditAddingNewCategory(true);
                          } else {
                            setEditAddingNewCategory(false);
                            setEditNewCategoryName('');
                            setEditCategoryId(e.target.value);
                          }
                        }}
                        className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
                      >
                        <option value="">No category</option>
                        {categories
                          .filter((c) => c.kind === editKind)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        <option value="__new__">+ New category…</option>
                      </select>
                      {editAddingNewCategory && (
                        <input
                          value={editNewCategoryName}
                          onChange={(e) => setEditNewCategoryName(e.target.value)}
                          placeholder={`New category name (under ${editKind === 'book' ? 'Books' : 'Past Question Packs'})`}
                          className="rounded-md border border-pulse-300 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
                          autoFocus
                        />
                      )}
                    </div>

                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                    />
                    <ImagePicker
                      value={editCoverImageUrl}
                      onChange={setEditCoverImageUrl}
                      purpose="resources"
                      label="Cover image (optional, falls back to a default cover if left blank)"
                    />
                    {editKind === 'past_question_pack' && (
                      <input
                        value={editInstitutionName}
                        onChange={(e) => setEditInstitutionName(e.target.value)}
                        placeholder="Institution name (e.g. UBTH School of Nursing)"
                        className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                      />
                    )}
                    <input
                      value={editSubjectTag}
                      onChange={(e) => setEditSubjectTag(e.target.value)}
                      placeholder="Subject tag (optional)"
                      className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                    />
                    {editPricing === 'paid' && (
                      <input
                        type="number"
                        min={0}
                        value={editPriceNaira}
                        onChange={(e) => setEditPriceNaira(Number(e.target.value))}
                        placeholder="Price in Naira"
                        className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                      />
                    )}
                    <input
                      value={editDriveLink}
                      onChange={(e) => setEditDriveLink(e.target.value)}
                      placeholder="Google Drive link (never shown to users directly)"
                      className="w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
                    />

                    {editError && <p className="text-sm text-critical-500">{editError}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}>Save changes</Button>
                      <Button size="sm" variant="secondary" onClick={cancelEdit}>Cancel</Button>
                    </div>
                  </>
                )}
              </Card>
            )}
          </div>
        ))}
      </div>

      {user?.role === 'admin' && (
        <>
          <h2 className="mt-10 font-display text-lg font-semibold text-ink-800">Pending payments</h2>
          <div className="mt-4 space-y-3">
            {pending.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink-800">{p.resourceTitle}</p>
                  {p.proofImageUrl && (
                    <a href={p.proofImageUrl} target="_blank" rel="noreferrer" className="text-xs text-pulse-600 underline">
                      View proof
                    </a>
                  )}
                  <p className="text-xs text-ink-400">{new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => confirmPurchase(p.id, 'confirmed')}>Confirm</Button>
                  <Button size="sm" variant="danger" onClick={() => confirmPurchase(p.id, 'rejected')}>Reject</Button>
                </div>
              </Card>
            ))}
            {pending.length === 0 && <p className="text-sm text-ink-400">No pending payments.</p>}
          </div>
        </>
      )}
    </div>
  );
}
