import { Request, Response } from 'express';
import { ActivityLogService } from '../services/activityLog.service';

export const createActivityLog = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const log = await ActivityLogService.createLog(data);
    res.status(201).json(log);
  } catch (error: any) {
    console.error('[ActivityLogController] Error creating log:', error);
    res.status(500).json({ error: error.message || 'Failed to create activity log' });
  }
};

export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 25;
    const search = (req.query.search as string) || '';
    const module = (req.query.module as string) || 'All';
    const status = (req.query.status as string) || 'All';

    const result = await ActivityLogService.getLogs({ page, pageSize, search, module, status });
    res.json(result);
  } catch (error: any) {
    console.error('[ActivityLogController] Error fetching logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch activity logs' });
  }
};
