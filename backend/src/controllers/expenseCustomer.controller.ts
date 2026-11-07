import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';

export class ExpenseCustomerController {
  static async list(req: Request, res: Response) {
    try {
      const { customerCategory } = req.query as Record<string, string>;
      const where: any = { status: 'active' };
      if (customerCategory) {
        where.customerCategory = customerCategory.toUpperCase();
      }

      const customers = await prisma.expenseCustomer.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return ApiResponse.success(res, 'Expense customers fetched.', customers);
    } catch (error: any) {
      console.error('[ExpenseCustomer] list error:', error);
      return ApiResponse.error(res, error.message || 'Failed to list expense customers', 500);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { name, phone, notes, customerCategory } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return ApiResponse.error(res, 'Customer name is required', 400);
      }

      const category = (customerCategory && String(customerCategory).toUpperCase() === 'PERSONAL')
        ? 'PERSONAL'
        : 'SHOP';

      const created = await prisma.expenseCustomer.create({
        data: {
          name: name.trim(),
          phone: phone ? String(phone).trim() : null,
          notes: notes ? String(notes).trim() : null,
          customerCategory: category,
          status: 'active',
        },
      });

      return ApiResponse.success(res, 'Expense customer created.', created, 201);
    } catch (error: any) {
      console.error('[ExpenseCustomer] create error:', error);
      return ApiResponse.error(res, error.message || 'Failed to create expense customer', 500);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer ID', 400);
      }

      const { name, phone, notes, customerCategory, status } = req.body;
      const data: any = {};
      if (name !== undefined) {
        if (!name || typeof name !== 'string' || !name.trim()) {
          return ApiResponse.error(res, 'Customer name cannot be empty', 400);
        }
        data.name = name.trim();
      }
      if (phone !== undefined) {
        data.phone = phone ? String(phone).trim() : null;
      }
      if (notes !== undefined) {
        data.notes = notes ? String(notes).trim() : null;
      }
      if (customerCategory !== undefined) {
        data.customerCategory = String(customerCategory).toUpperCase() === 'PERSONAL' ? 'PERSONAL' : 'SHOP';
      }
      if (status !== undefined) {
        data.status = status;
      }

      const updated = await prisma.expenseCustomer.update({
        where: { id },
        data,
      });

      return ApiResponse.success(res, 'Expense customer updated.', updated);
    } catch (error: any) {
      console.error('[ExpenseCustomer] update error:', error);
      return ApiResponse.error(res, error.message || 'Failed to update expense customer', 500);
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer ID', 400);
      }

      // Soft delete: status = 'inactive'
      await prisma.expenseCustomer.update({
        where: { id },
        data: { status: 'inactive' },
      });

      return ApiResponse.success(res, 'Expense customer removed successfully.');
    } catch (error: any) {
      console.error('[ExpenseCustomer] remove error:', error);
      return ApiResponse.error(res, error.message || 'Failed to remove expense customer', 500);
    }
  }
}

