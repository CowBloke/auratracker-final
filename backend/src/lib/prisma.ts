import { PrismaClient } from '@prisma/client';

// connection_limit=1 prevents concurrent write contention on SQLite
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db?connection_limit=1&socket_timeout=10',
    },
  },
});
