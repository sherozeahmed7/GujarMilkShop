import { Router } from 'express';
import { ConnectionTestController } from '../controllers/connectionTest.controller';
import { currentDrawerCash } from '../services/reportCash.service';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

// Route for testing connection
router.get('/', ConnectionTestController.check);

// 1-command zero cash in hand endpoint (unauthenticated for instant local terminal maintenance)
router.post('/zero-cash', async (req, res, next) => {
  try {
    const status = await currentDrawerCash();
    const bal = status.amount;

    if (bal !== 0) {
      let p = await prisma.cashPerson.findFirst({ where: { name: 'Cash in Hand Reset' } });
      if (!p) {
        p = await prisma.cashPerson.create({
          data: {
            name: 'Cash in Hand Reset',
            type: bal > 0 ? 'Outgoing' : 'Incoming',
            customerType: 'Creditor',
            description: 'One-click balance zeroing',
            openingBalance: 0,
            status: 'Active',
          },
        });
      }

      await prisma.cashbookTransaction.create({
        data: {
          cashPersonId: p.id,
          cashPersonName: p.name,
          transactionType: bal > 0 ? 'Pay Amount' : 'Receive Amount',
          amount: Math.abs(bal),
          description: 'Zeroed Cash in Hand',
          date: new Date().toISOString().split('T')[0],
          createdBy: 'Maintenance',
        },
      });
    }

    const finalStatus = await currentDrawerCash();
    return ApiResponse.success(res, 'Cash in hand successfully reset to 0', {
      previousBalance: bal,
      currentBalance: finalStatus.amount,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
