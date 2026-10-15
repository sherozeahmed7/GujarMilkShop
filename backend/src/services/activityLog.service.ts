import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import { Prisma } from '@prisma/client';

export interface CreateActivityLogDto {
  user: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  entityId?: string;
  ip?: string;
  status: string;
}

export interface GetLogsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  status?: string;
}

export interface PaginatedLogs {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const HARD_MAX_PAGE_SIZE = 25;

export class ActivityLogService {
  static async createLog(data: CreateActivityLogDto) {
    return prisma.$transaction(async (tx) => {
      const log = await tx.activityLog.create({
        data: {
          timestamp: new Date(),
          user: data.user,
          userRole: data.userRole,
          action: data.action,
          module: data.module,
          description: data.description,
          entityId: data.entityId,
          ip: data.ip,
          status: data.status,
        }
      });

      // Mapping and queue creation use this same transaction client. Any failure
      // rolls the ActivityLog, LocalToCloudMapping, and SyncQueue writes back.
      await SyncQueueService.enqueueCreate(tx, 'ActivityLog', log.id, log, 4);
      return log;
    });
  }

  static async getLogs(params: GetLogsParams = {}): Promise<PaginatedLogs> {
    const pageSize = Math.min(params.pageSize ?? HARD_MAX_PAGE_SIZE, HARD_MAX_PAGE_SIZE);
    const page = Math.max(params.page ?? 1, 1);
    const skip = (page - 1) * pageSize;

    // Build WHERE conditions
    const where: Prisma.ActivityLogWhereInput = {};

    if (params.module && params.module !== 'All') {
      where.module = params.module;
    }

    if (params.status && params.status !== 'All') {
      where.status = params.status;
    }

    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      where.OR = [
        { description: { contains: term } },
        { action: { contains: term } },
        { user: { contains: term } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
