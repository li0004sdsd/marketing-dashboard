import { DataSource } from 'typeorm';

async function checkMigrations() {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/migrations/*.ts'],
  });

  await ds.initialize();

  try {
    await ds.runMigrations({ transaction: 'all' });

    const pendingCount = ds.migrations.length - (await ds.showMigrations()).length;
    console.log(`✓ ${ds.migrations.length} 个迁移全部可在空库上成功执行`);

    const baselineMigration = ds.migrations.find(
      m => m.name && m.name.includes('BaselineInit'),
    );
    if (!baselineMigration) {
      console.error('✗ 未找到 BaselineInit 基线迁移');
      process.exit(1);
    }
    console.log('✓ 基线迁移存在');

    const baselineUp = baselineMigration.instance?.up;
    const baselineDown = baselineMigration.instance?.down;
    if (!baselineUp || !baselineDown) {
      console.error('✗ 基线迁移缺少 up/down 方法');
      process.exit(1);
    }
    console.log('✓ 基线迁移 up/down 方法完整');

    for (const migration of ds.migrations) {
      if (!migration.instance?.up || !migration.instance?.down) {
        console.error(`✗ 迁移 ${migration.name} 缺少 up 或 down 方法`);
        process.exit(1);
      }
    }
    console.log('✓ 所有迁移均包含可回滚的 down 方法');
  } catch (err) {
    console.error('✗ 迁移执行验证失败:', err);
    process.exit(1);
  } finally {
    await ds.destroy();
  }
}

checkMigrations();
