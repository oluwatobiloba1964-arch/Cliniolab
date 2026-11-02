import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { featureFlagService, resourceService } from '@/lib/db';
import type { ResourceKind, ResourcePricing } from '@/types';

export async function GET(request: Request) {
  // Admin route: always return resources regardless of the public feature
  // flag. The flag controls the public-facing page, not the admin panel.
  // Admins need to be able to manage resources even when they are hidden
  // from regular users.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;

  const resources = await resourceService.listResources(limit);
  return NextResponse.json({ enabled: true, resources });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canAccessAdminPanel(user.role)) {
    return NextResponse.json({ error: 'Admin/moderator access required' }, { status: 403 });
  }

  let body: {
    kind: ResourceKind;
    categoryId?: string;
    newCategoryName?: string;
    title: string;
    description?: string;
    coverImageUrl?: string;
    institutionName?: string;
    subjectTag?: string;
    pricing: ResourcePricing;
    priceKobo?: number;
    driveLink: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title || !body.driveLink || !body.kind || !body.pricing) {
    return NextResponse.json(
      { error: 'title, driveLink, kind, and pricing are required' },
      { status: 400 }
    );
  }
  if (body.pricing === 'paid' && !body.priceKobo) {
    return NextResponse.json({ error: 'priceKobo is required for paid resources' }, { status: 400 });
  }

  const resource = await resourceService.createResource(user.id, body);
  return NextResponse.json({ resource }, { status: 201 });
}
