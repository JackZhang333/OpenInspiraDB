export function createLogger(namespace) {
  return {
    debug(message, context = {}) {
      console.log(JSON.stringify({ level: 'debug', namespace, message, context, ts: new Date().toISOString() }));
    },
    info(message, context = {}) {
      console.log(JSON.stringify({ level: 'info', namespace, message, context, ts: new Date().toISOString() }));
    },
    error(message, context = {}) {
      console.error(JSON.stringify({ level: 'error', namespace, message, context, ts: new Date().toISOString() }));
    },
  };
}
