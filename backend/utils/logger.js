const fs = require('fs');
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = path.join(__dirname, '..', 'logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function shouldLog(level) {
  return levels[level] >= levels[LOG_LEVEL];
}

function formatTime() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

function writeLog(level, message, data = null) {
  if (!shouldLog(level)) return;
  
  const timestamp = formatTime();
  const levelPad = level.toUpperCase().padEnd(5);
  let logLine = `[${timestamp}] [${levelPad}] ${message}`;
  
  if (data) {
    logLine += ' ' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
  
  console.log(logLine);
  
  // 写入文件
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logLine + '\n');
}

module.exports = {
  debug: (message, data) => writeLog('debug', message, data),
  info: (message, data) => writeLog('info', message, data),
  warn: (message, data) => writeLog('warn', message, data),
  error: (message, data) => writeLog('error', message, data),
  
  // 请求日志中间件
  requestLogger: (req, res, next) => {
    const start = Date.now();
    const { method, url, ip } = req;
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      writeLog(level, `${method} ${url} ${statusCode} ${duration}ms - ${ip}`);
    });
    
    next();
  }
};
