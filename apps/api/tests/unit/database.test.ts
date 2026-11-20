import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPrismaClient, disconnectPrisma } from '../../src/config/database.js';
import { getPrismaClient as getPrismaFromService } from '../../src/database/prisma.service.js';
import { Prisma, PrismaClient } from '@prisma/client';

describe('Database Configuration & Prisma Singleton Lifecycle', () => {
  beforeEach(async () => {
    await disconnectPrisma();
  });

  it('initializes and returns a PrismaClient instance using ESM', () => {
    const prisma = getPrismaClient();
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$disconnect).toBe('function');
    expect(typeof prisma.$transaction).toBe('function');
  });

  it('maps the User model to the users table in PostgreSQL public schema', () => {
    const userModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'User');
    expect(userModel?.dbName).toBe('users');
  });

  it('maintains a single singleton instance across multiple calls without duplication', () => {
    const prisma1 = getPrismaClient();
    const prisma2 = getPrismaClient();
    expect(prisma1).toBe(prisma2);
  });

  it('shares the exact same singleton instance through prisma.service.ts re-export', () => {
    const prismaFromConfig = getPrismaClient();
    const prismaFromService = getPrismaFromService();
    expect(prismaFromConfig).toBe(prismaFromService);
  });

  it('disconnectPrisma calls $disconnect and resets the instance', async () => {
    const prisma = getPrismaClient();
    const disconnectSpy = vi.spyOn(prisma, '$disconnect').mockResolvedValue(undefined as never);

    await disconnectPrisma();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);

    // After disconnect, subsequent call should create a fresh singleton
    const newPrisma = getPrismaClient();
    expect(newPrisma).toBeDefined();
    expect(newPrisma).not.toBe(prisma);
  });
});
