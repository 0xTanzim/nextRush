/**
 * 📊 WebSocket Statistics Tracker
 * Real-time WebSocket performance monitoring and metrics
 */

import { EventEmitter } from 'events';
import { WSStats } from './types';

/**
 * WebSocket statistics tracker
 */
export class WSStatsTracker extends EventEmitter {
  private stats: WSStats;
  private startTime: number;

  constructor() {
    super();
    this.startTime = Date.now();
    this.stats = {
      connections: 0,
      totalConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      rooms: 0,
      uptime: 0,
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0,
      reconnections: 0,
    };
  }

  /**
   * Increment connection count
   */
  incrementConnections(): void {
    this.stats.connections++;
    this.stats.totalConnections++;
    this.emit('stats:connection:increment');
  }

  /**
   * Decrement connection count
   */
  decrementConnections(): void {
    this.stats.connections = Math.max(0, this.stats.connections - 1);
    this.emit('stats:connection:decrement');
  }

  /**
   * Increment messages sent
   */
  incrementMessagesSent(bytes: number = 0): void {
    this.stats.messagesSent++;
    this.stats.bytesSent += bytes;
    this.emit('stats:message:sent', bytes);
  }

  /**
   * Increment messages received
   */
  incrementMessagesReceived(bytes: number = 0): void {
    this.stats.messagesReceived++;
    this.stats.bytesReceived += bytes;
    this.emit('stats:message:received', bytes);
  }

  /**
   * Set room count
   */
  setRoomCount(count: number): void {
    this.stats.rooms = count;
    this.emit('stats:rooms:update', count);
  }

  /**
   * Increment error count
   */
  incrementErrors(): void {
    this.stats.errors++;
    this.emit('stats:error:increment');
  }

  /**
   * Increment reconnection count
   */
  incrementReconnections(): void {
    this.stats.reconnections++;
    this.emit('stats:reconnection:increment');
  }

  /**
   * Get current statistics
   */
  getStats(): WSStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.startTime = Date.now();
    this.stats = {
      connections: 0,
      totalConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      rooms: 0,
      uptime: 0,
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0,
      reconnections: 0,
    };
    this.emit('stats:reset');
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    messagesPerSecond: number;
    bytesPerSecond: number;
    averageMessageSize: number;
    errorRate: number;
    reconnectionRate: number;
  } {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    const totalMessages = this.stats.messagesSent + this.stats.messagesReceived;
    const totalBytes = this.stats.bytesSent + this.stats.bytesReceived;

    return {
      messagesPerSecond: uptimeSeconds > 0 ? totalMessages / uptimeSeconds : 0,
      bytesPerSecond: uptimeSeconds > 0 ? totalBytes / uptimeSeconds : 0,
      averageMessageSize: totalMessages > 0 ? totalBytes / totalMessages : 0,
      errorRate:
        this.stats.totalConnections > 0
          ? this.stats.errors / this.stats.totalConnections
          : 0,
      reconnectionRate:
        this.stats.totalConnections > 0
          ? this.stats.reconnections / this.stats.totalConnections
          : 0,
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    score: number;
  } {
    const metrics = this.getPerformanceMetrics();
    const issues: string[] = [];
    let score = 100;

    // Check error rate
    if (metrics.errorRate > 0.1) {
      issues.push('High error rate');
      score -= 30;
    } else if (metrics.errorRate > 0.05) {
      issues.push('Elevated error rate');
      score -= 15;
    }

    // Check reconnection rate
    if (metrics.reconnectionRate > 0.2) {
      issues.push('High reconnection rate');
      score -= 25;
    } else if (metrics.reconnectionRate > 0.1) {
      issues.push('Elevated reconnection rate');
      score -= 10;
    }

    // Check connection count
    if (this.stats.connections > 900) {
      issues.push('Near connection limit');
      score -= 20;
    }

    // Determine status
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return { status, issues, score };
  }

  /**
   * Log statistics
   */
  logStats(): void {
    const stats = this.getStats();
    const metrics = this.getPerformanceMetrics();
    const health = this.getHealthStatus();

    console.log('📊 WebSocket Statistics:', {
      connections: stats.connections,
      totalConnections: stats.totalConnections,
      rooms: stats.rooms,
      messagesPerSecond: metrics.messagesPerSecond.toFixed(2),
      errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
      healthStatus: health.status,
      healthScore: health.score,
    });

    if (health.issues.length > 0) {
      console.warn('⚠️ WebSocket Health Issues:', health.issues);
    }
  }
}
