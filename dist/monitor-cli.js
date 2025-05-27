#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const monitor_1 = require("./monitor");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Simple CLI tool to display system stats
async function showSystemStats() {
    try {
        console.log('🔍 Collecting system statistics...');
        const stats = await (0, monitor_1.collectSystemStats)();
        console.log('\n📊 Noxhime System Monitor');
        console.log('=========================');
        console.log(`CPU Usage:     ${stats.cpuUsage.toFixed(1)}%`);
        console.log(`Memory Usage:  ${stats.memoryUsage.toFixed(1)}%`);
        console.log(`Disk Usage:    ${stats.diskUsage.toFixed(1)}%`);
        console.log(`System Uptime: ${stats.uptime}`);
        console.log('=========================');
        // Show status indicators
        const cpuStatus = stats.cpuUsage > 90 ? '🔴 HIGH' : stats.cpuUsage > 70 ? '🟠 MEDIUM' : '🟢 NORMAL';
        const memStatus = stats.memoryUsage > 90 ? '🔴 HIGH' : stats.memoryUsage > 70 ? '🟠 MEDIUM' : '🟢 NORMAL';
        const diskStatus = stats.diskUsage > 90 ? '🔴 HIGH' : stats.diskUsage > 70 ? '🟠 MEDIUM' : '🟢 NORMAL';
        console.log(`CPU Status:    ${cpuStatus}`);
        console.log(`Memory Status: ${memStatus}`);
        console.log(`Disk Status:   ${diskStatus}`);
    }
    catch (error) {
        console.error('Error collecting system statistics:', error);
    }
}
// Run the stats display
showSystemStats();
