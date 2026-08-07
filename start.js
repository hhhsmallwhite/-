/**
 * 天天记账 —— 启动脚本（小帮手）
 *
 * 为什么需要它？
 * 有些电脑环境会自动注入一个叫 ELECTRON_RUN_AS_NODE 的隐藏变量，
 * 它会让 Electron 误以为自己只是普通后台程序，导致打不开窗口。
 * 这个脚本负责在启动前把这类干扰变量清掉，保证任何环境下
 * `npm start` 都能正常弹出软件窗口。
 */

// ① 清掉两个可能干扰 Electron 正常启动的隐藏变量
delete process.env.ELECTRON_RUN_AS_NODE;
delete process.env.ELECTRON_FORCE_RENDERER_ACCESSIBILITY;

// ② 正常启动 Electron 引擎（路径由 electron 包提供）
const { spawn } = require('child_process');
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env
});

// ③ 软件关闭时，启动脚本跟着退出，保持状态一致
child.on('close', (code, signal) => {
  if (code === null) process.exit(signal ? 1 : 0);
  process.exit(code);
});
