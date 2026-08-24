import { prisma } from '../config/database';

export interface HeldCartSnapshot {
  cart: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: 'kg' | 'rs';
    total: number;
    pricePerKg: number;
  }>;
  discount: number;
  paymentMethod: 'cash' | 'online' | 'split' | 'khata';
  splitPaidAmount: string;
  customerName: string;
  customerPhone: string;
  selectedKhataCustomer: unknown | null;
}

export class HeldCartService {
  static async create(userId: number, snapshot: HeldCartSnapshot) {
    if (!snapshot || !Array.isArray(snapshot.cart) || snapshot.cart.length === 0) {
      return { success: false, message: 'Cannot hold an empty cart.', statusCode: 400 };
    }

    const heldCart = await prisma.heldCart.create({
      data: {
        userId,
        snapshot: JSON.stringify(snapshot),
      },
    });

    return { success: true, data: heldCart, statusCode: 201 };
  }

  static async list(userId: number) {
    const heldCarts = await prisma.heldCart.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return heldCarts.map((heldCart) => ({
      id: heldCart.id,
      createdAt: heldCart.createdAt,
      snapshot: JSON.parse(heldCart.snapshot) as HeldCartSnapshot,
    }));
  }

  static async resume(userId: number, id: number) {
    const heldCart = await prisma.heldCart.findFirst({ where: { id, userId } });
    if (!heldCart) return { success: false, message: 'Held bill not found.', statusCode: 404 };

    await prisma.heldCart.delete({ where: { id: heldCart.id } });
    return {
      success: true,
      data: {
        id: heldCart.id,
        createdAt: heldCart.createdAt,
        snapshot: JSON.parse(heldCart.snapshot) as HeldCartSnapshot,
      },
      statusCode: 200,
    };
  }

  static async remove(userId: number, id: number) {
    const heldCart = await prisma.heldCart.findFirst({ where: { id, userId } });
    if (!heldCart) return { success: false, message: 'Held bill not found.', statusCode: 404 };

    await prisma.heldCart.delete({ where: { id: heldCart.id } });
    return {
      success: true,
      data: {
        id: heldCart.id,
        createdAt: heldCart.createdAt,
      },
      statusCode: 200,
    };
  }
}
