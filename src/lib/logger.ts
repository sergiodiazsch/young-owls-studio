/**
 * Structured logger for Screenplay Studio.
 *
 * - Development: human-readable console output with timestamps.
 * - Production:  JSON-formatted lines for log aggregators (Datadog, etc.).
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Project created", { projectId: 42 });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDev = process.env.NODE_ENV !== "production";

// In production only info+ is emitted; in dev everything including debug.
const minLevel: LogLevel = isDev ? "debug" : "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function formatDev(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5);
  const base = `${ts} [${tag}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

function formatJson(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const line = isDev ? formatDev(level, message, meta) : formatJson(level, message, meta);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
