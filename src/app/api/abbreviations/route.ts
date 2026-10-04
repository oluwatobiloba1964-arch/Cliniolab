import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/currentUser';
import { permissions } from '@/lib/auth/permissions';
import { abbreviationService, featureFlagService } from '@/lib/db';

function parseKind(value: string | null): 'abbreviation' | 'glossary' | 'all' {
  return value === 'abbreviation' || value === 'glossary' ? value : 'all';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') ?? undefined;
  const random = searchParams.get('random');
  const kind = parseKind(searchParams.get('kind'));
  const page = searchParams.get('page');
  const pageSize = searchParams.get('pageSize');

  if (random) {
    const abbreviations = await abbreviationService.listRandomAbbreviations(Number(random), kind);
    return NextResponse.json({ abbreviations }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } });
  }

  if (page) {
    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 40));
    const [abbreviations, total] = await Promise.all([
      abbreviationService.listAbbreviationsPage(pageNum, size, search, kind),
      abbreviationService.countAbbreviations(search, kind),
    ]);
    return NextResponse.json({
      abbreviations,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(total / size)),
    }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' } });
  }

  const abbreviations = await abbreviationService.listAbbreviations(search, kind);
  return NextResponse.json({ abbreviations }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!permissions.canManageLearningContent(user.role)) {
    return NextResponse.json({ error: 'Only admins/moderators can add abbreviations' }, { status: 403 });
  }

  const enabled = await featureFlagService.isFeatureEnabled('medical_abbreviations');
  if (!enabled) {
    return NextResponse.json({ error: 'Medical abbreviations are currently disabled' }, { status: 403 });
  }

  let body: { abbreviation: string; meaning: string; category?: string; isGlossary?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.abbreviation?.trim() || !body.meaning?.trim()) {
    return NextResponse.json({ error: 'abbreviation and meaning are required' }, { status: 400 });
  }

  const abbreviation = await abbreviationService.createAbbreviation(user.id, body);
  return NextResponse.json({ abbreviation }, { status: 201 });
}
