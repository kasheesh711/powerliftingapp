import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}
