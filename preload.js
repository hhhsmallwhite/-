/**
 * 黑马记账 —— 接线文件（preload）
 *
 * 用大白话解释：软件的"界面"和"后台数据"中间隔着一道安全门。
 * 这个文件负责在这道门上开一个安全的小窗口，
 * 让界面代码能安全地使用后台功能，又碰不到电脑系统的核心区域。
 *
 * 目前只放了一个版本号，后续阶段会在这里添加记账相关的安全接口。
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('blackhorse', {
  appVersion: '0.1.0',
  platform: process.platform // 'win32' 是 Windows，'darwin' 是 Mac
});
