import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FunnelSpecSchema } from '@/lib/schema';

async function authenticateByApiKey(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return prisma.user.findUnique({ where: { apiKey: match[1] } });
}

export async function POST(request: Request) {
  const user = await authenticateByApiKey(request);
  if (!user) {
    return NextResponse.json({ error: 'Missing or invalid Authorization: Bearer <apiKey> header' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = FunnelSpecSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Funnel spec failed validation', issues: parsed.error.issues }, { status: 400 });
  }

  const spec = parsed.data;
  const funnel = await prisma.funnel.create({
    data: {
      name: spec.funnelName,
      ownerId: user.id,
      status: 'draft',
      steps: {
        create: spec.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => ({
            order: step.order,
            label: step.label,
            urlPattern: step.urlPattern,
            triggerType: step.trigger.type,
            selector: step.trigger.selector,
            formFieldsJson: step.formFields ? JSON.stringify(step.formFields) : null,
          })),
      },
    },
    include: { steps: true },
  });

  return NextResponse.json({ id: funnel.id, status: funnel.status }, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const funnels = await prisma.funnel.findMany({
    where: { ownerId: (session.user as { id: string }).id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { steps: true } } },
  });

  return NextResponse.json({ funnels });
}
