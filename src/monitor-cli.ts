#!/usr/bin/env node

import { collectSystemStats } from './monitor';
import dotenv from 'dotenv';

dotenv.config();

// Simple CLI tool to display system stats
async function showSystemStats(): Promise<void> {
  try {
    console.log('🔍 Collecting system statistics...');
    const stats = await collectSystemStats();
    
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
  } catch (error) {
    console.error('Error collecting system statistics:', error);
  }
}

// Run the stats display
showSystemStats();
