import { apiClient } from './apiClient';
import { ShiftRecord, ShiftLedgerResponse } from '../types';

export const shiftService = {
  async getShifts(): Promise<ShiftRecord[]> {
    const response = await apiClient.get('/shifts');
    return response.data as ShiftRecord[];
  },

  async getShiftLedger(shiftId: number): Promise<ShiftLedgerResponse> {
    const response = await apiClient.get('/shifts/' + shiftId + '/ledger');
    return response.data as ShiftLedgerResponse;
  },

  async openShift(openingCash: number, openingNotes: string): Promise<ShiftRecord> {
    const response = await apiClient.post('/shifts', { openingCash, openingNotes });
    return response.data as ShiftRecord;
  },

  async closeShift(countedCash: number, closingNotes: string): Promise<ShiftRecord> {
    const response = await apiClient.post('/shifts/close', { countedCash, closingNotes });
    return response.data as ShiftRecord;
  },
};
