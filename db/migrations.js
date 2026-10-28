/**
 * 天天记账 —— 数据库「搬家记录本」（迁移）
 *
 * 大白话：这个账本用久了，难免要「改建」——比如加个字段、加个索引。
 * 麻烦的是：用户电脑里的账本里已经存着真实数据，不能删了重来。
 * 所以每次改建都编一个号（第 1 号、第 2 号……），记在这张清单里。
 * 软件打开账本时会问一句「你改到第几号了」（存在 SQLite 自带的 user_version 里），
 * 然后只补做剩下没做的部分。老账本升级、新账本从头建，走的都是同一套流程。
 *
 * 加新迁移的规矩（以后要改表结构，照着做就行）：
 *   1. 在数组末尾追加一条，version 递增，不要跳号；
 *   2. 不要改动已经发出去的那几条（老用户已经执行过了，改了也不会重跑）；
 *   3. up 里只做加法（加表/加列/加索引），不要删用户数据。
 */

/**
 * 迁移清单：按 version 从小到大执行，只往前跑，不回头。
 * 每条包含：version（编号）、name（干什么用的，报错时能看出是哪一步）、up（具体动作）
 */
const MIGRATIONS = [
  {
    version: 1,
    name: '建账目表',
    // 第一版就一张表：records（每一笔账一行）。
    // 金额用「分」存整数，避免 12.34 这种小数在电脑里加减出误差。
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS records (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          type          TEXT    NOT NULL,
          amount_cents  INTEGER NOT NULL,
          category_main TEXT    NOT NULL,
          category_sub  TEXT    NOT NULL,
          note          TEXT    DEFAULT '',
          date          TEXT    NOT NULL,
          created_at    INTEGER NOT NULL
        )
      `);
    }
  },
  {
    version: 2,
    name: '加查询索引',
    // 账本里所有查询都是「按日期范围捞 + 按日期倒序排」。
    // 没有索引时 SQLite 要把整张表翻一遍；加了这个索引，几千条以后也不会变慢。
    // 索引只是「目录」，不动任何一条账目数据，加上去是安全的。
    up(db) {
      db.exec('CREATE INDEX IF NOT EXISTS idx_records_date ON records(date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_records_type_date ON records(type, date)');
    }
  }
];

module.exports = { MIGRATIONS };
