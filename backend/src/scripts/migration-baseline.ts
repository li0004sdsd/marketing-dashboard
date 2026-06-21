import { DataSource } from 'typeorm';
import { BaselineInit } from './migrations/1700000000000-BaselineInit';

async function baseline() {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DB_PATH || 'marketing_dashboard.db',
  });

  await ds.initialize();

  try {
    const result = await ds.query(
      `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='users'`,
    );
    const usersExists = result[0].cnt > 0;

    const migrationTableResult = await ds.query(
      `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='migrations'`,
    );
    const migrationTableExists = migrationTableResult[0].cnt > 0;

    if (!usersExists) {
      console.log('未检测到已有表结构，将从头执行所有迁移');
      return;
    }

    if (migrationTableExists) {
      const rows = await ds.query(
        `SELECT COUNT(*) as cnt FROM migrations WHERE name = ?`,
        [new BaselineInit().name],
      );
      if (rows[0].cnt > 0) {
        console.log('基线迁移已记录，无需重复操作');
        return;
      }
    }

    await ds.query(`
      CREATE TABLE IF NOT EXISTS "migrations" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "timestamp" bigint NOT NULL,
        "name" varchar NOT NULL
      )
    `);

    await ds.query(
      `INSERT INTO migrations (timestamp, name) VALUES (?, ?)`,
      [1700000000000, new BaselineInit().name],
    );

    console.log('✓ 基线迁移已标记为已完成 (仅插入记录，未执行 DDL)');
    console.log('  已有表结构保持不变，后续增量迁移将正常执行');
  } finally {
    await ds.destroy();
  }
}

baseline().catch(err => {
  console.error('基线标记失败:', err);
  process.exit(1);
});
