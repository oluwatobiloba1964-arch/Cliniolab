'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Category, Subcategory } from '@/types';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCategoryId, setNewSubCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Which item is pending a delete-confirmation click ("click again to
  // confirm" instead of a modal, since this list is usually short).
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
        setSubcategories(data.subcategories ?? []);
      });
  }

  useEffect(load, []);

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setError(null);
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', name: newCategoryName, slug: slugify(newCategoryName) }),
    });
    if (res.ok) {
      setNewCategoryName('');
      load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function addSubcategory() {
    if (!newSubName.trim() || !newSubCategoryId) return;
    setError(null);
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subcategory',
        name: newSubName,
        slug: slugify(newSubName),
        categoryId: newSubCategoryId,
      }),
    });
    if (res.ok) {
      setNewSubName('');
      load();
    } else {
      const data = await res.json();
      setError(data.error);
    }
  }

  async function deleteItem(type: 'category' | 'subcategory', id: string) {
    if (confirmingDelete !== id) {
      // First click just arms the confirmation; the button itself
      // switches to "Confirm delete" so there's no separate modal to
      // build for what should be a rare, careful action.
      setConfirmingDelete(id);
      return;
    }
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        load();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setConfirmingDelete(null);
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Categories</h1>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-ink-700">Add category</h2>
        <div className="mt-2 flex gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name"
            className="flex-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <Button size="sm" onClick={addCategory}>Add</Button>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-700">Add subcategory</h2>
        <div className="mt-2 flex gap-2">
          <select
            value={newSubCategoryId}
            onChange={(e) => setNewSubCategoryId(e.target.value)}
            className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            placeholder="Subcategory name"
            className="flex-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm focus:border-pulse-400 focus:outline-none"
          />
          <Button size="sm" onClick={addSubcategory}>Add</Button>
        </div>
      </Card>

      {error && <p className="mt-3 text-sm text-critical-500">{error}</p>}

      <div className="mt-8 space-y-6">
        {categories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-ink-800">{cat.name}</h3>
              <button
                type="button"
                onClick={() => deleteItem('category', cat.id)}
                disabled={deletingId === cat.id}
                className={`text-xs font-medium ${
                  confirmingDelete === cat.id
                    ? 'text-critical-600 underline'
                    : 'text-ink-400 hover:text-critical-500'
                }`}
              >
                {deletingId === cat.id
                  ? 'Deleting…'
                  : confirmingDelete === cat.id
                    ? 'Confirm delete?'
                    : 'Delete'}
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {subcategories.filter((s) => s.categoryId === cat.id).map((sub) => (
                <li key={sub.id} className="flex items-center gap-2 text-sm text-ink-500">
                  <span>· {sub.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteItem('subcategory', sub.id)}
                    disabled={deletingId === sub.id}
                    className={`text-xs font-medium ${
                      confirmingDelete === sub.id
                        ? 'text-critical-600 underline'
                        : 'text-ink-400 hover:text-critical-500'
                    }`}
                  >
                    {deletingId === sub.id
                      ? 'Deleting…'
                      : confirmingDelete === sub.id
                        ? 'Confirm delete?'
                        : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
