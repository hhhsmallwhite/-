/**
 * 天天记账 —— 主进程与界面之间的「通道清单」
 *
 * 大白话：界面想找主进程办事，得先喊一个「暗号」（通道名）。
 * 这个文件就是全部暗号的清单，只有一份，两头都照着它来：
 *   - preload.js：界面这边按清单喊；
 *   - main/ipc.js：主进程这边按清单接。
 *
 * 为什么单独列一份：以前两头的暗号是各写各的字符串，改一个忘一个，
 * 就会出现「界面点了没反应、控制台也没报错」这种最难查的毛病。
 * 现在 test/ipc-contract.test.js 会拿这张清单去核对两边，对不上直接测试失败。
 */

// 通道名 = 「谁:干什么」。前缀只有三类：app（软件信息）、db（账本）、export（导出）、game（小游戏）
const CHANNELS = [
  // 软件自己的信息（版本号之类）
  'app:getInfo',
  // 打开日志文件夹（出问题时把日志发给开发者看）
  'app:openLogsFolder',
  // 界面报上来的错误，写进日志文件
  'log:write',

  // 账本
  'db:addRecord',
  'db:getRecentRecords',
  'db:getMonthlySummary',
  'db:getRecordsByMonth',
  'db:getCategoryTotals',
  'db:getMonthlyTrend',
  'db:getDateRange',
  'db:updateRecord',
  'db:deleteRecord',

  // 导出备份 / 导回来 / 恢复整本备份
  'export:exportCsv',
  'import:importCsv',
  'backup:create',
  'backup:restore',
  'backup:info',

  // 贪吃蛇最高分
  'game:getHighScore',
  'game:setHighScore'
];

module.exports = { CHANNELS };
