import type { PrismaClient } from '@prisma/client';
import { accrueBusinessSupply } from '../modules/you/supply.js';

let _timer: ReturnType<typeof setInterval> | null = null;

export const startSupplyProductionScheduler = (prisma: PrismaClient): void => {
  if (_timer) return;
  void accrueBusinessSupply(prisma);
  _timer = setInterval(() => {
    void accrueBusinessSupply(prisma);
  }, 15 * 60_000);
};

export const stopSupplyProductionScheduler = (): void => {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
};
