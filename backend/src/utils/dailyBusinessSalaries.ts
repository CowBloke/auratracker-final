import type { PrismaClient } from '@prisma/client';
import { runDailyBusinessSalaryPayments } from '../modules/you/service.js';

let _timer: ReturnType<typeof setInterval> | null = null;

export const startDailyBusinessSalaryScheduler = (prisma: PrismaClient): void => {
  if (_timer) return;
  void runDailyBusinessSalaryPayments(prisma);
  _timer = setInterval(() => {
    void runDailyBusinessSalaryPayments(prisma);
  }, 60 * 60_000);
};

export const stopDailyBusinessSalaryScheduler = (): void => {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
};
