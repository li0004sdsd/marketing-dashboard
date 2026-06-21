import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduledSubscriptions1700000000001 implements MigrationInterface {
  name = 'AddScheduledSubscriptions1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scheduled_subscriptions" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "name" varchar NOT NULL,
        "cronExpression" varchar NOT NULL,
        "email" varchar NOT NULL,
        "enabled" boolean NOT NULL DEFAULT 1,
        "status" varchar NOT NULL DEFAULT 'idle',
        "lastRunAt" datetime,
        "lastBatchId" varchar,
        "lastError" varchar,
        "consecutiveFailures" integer NOT NULL DEFAULT 0,
        "lockedAt" datetime,
        "userId" integer NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_subscriptions"`);
  }
}
