import { prisma } from '../config/database';

export async function writeActivityLog(params: {
  userId?: number;
  userName?: string;
  userRole?: string;
  module: string;
  action: string;
  description: string;
  entityId?: string;
  status?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        userName: params.userName || 'System',
        userRole: params.userRole || '',
        module: params.module,
        action: params.action,
        description: params.description,
        entityId: params.entityId || null,
        status: params.status || 'Success',
      },
    });
  } catch (e) {
    console.error('[ActivityLog] failed to write', e);
  }
}

export class ActivityLogService {
  static async list(limit = 200) {
    return prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  static async create(params: {
    userId?: number;
    userName?: string;
    userRole?: string;
    module: string;
    action: string;
    description: string;
    entityId?: string;
    status?: string;
  }) {
    return prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        userName: params.userName || 'System',
        userRole: params.userRole || '',
        module: params.module,
        action: params.action,
        description: params.description,
        entityId: params.entityId || null,
        status: params.status || 'Success',
      },
    });
  }
}
