type Level = 'debug' | 'info' | 'warn' | 'error'

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  const payload = meta ? `${message} ${JSON.stringify(meta)}` : message
  if (level === 'error') {
    console.error(payload)
    return
  }
  if (level === 'warn') {
    console.warn(payload)
    return
  }
  if (level === 'info') {
    console.info(payload)
    return
  }
  console.debug(payload)
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    write('debug', message, meta)
  },
  info(message: string, meta?: Record<string, unknown>) {
    write('info', message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>) {
    write('warn', message, meta)
  },
  error(message: string, meta?: Record<string, unknown>) {
    write('error', message, meta)
  },
}
