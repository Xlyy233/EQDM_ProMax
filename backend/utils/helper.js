function success(data, message = '操作成功') {
  return { code: 200, data, message };
}

function error(message, code = 500) {
  return { code, data: null, message };
}

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function genId(prefix = '') {
  return prefix + Date.now().toString() + Math.floor(Math.random() * 1000);
}

function camelToUnderscore(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function underscoreToCamel(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function rowToCamel(row) {
  if (!row) return row;
  const result = {};
  for (const key in row) {
    result[underscoreToCamel(key)] = row[key];
  }
  return result;
}

function rowsToCamel(rows) {
  if (!rows) return rows;
  return rows.map(rowToCamel);
}

function parsePagination(query) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || 20;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function buildLikePattern(keyword) {
  return '%' + (keyword || '').trim().toLowerCase() + '%';
}

module.exports = {
  success,
  error,
  now,
  genId,
  camelToUnderscore,
  underscoreToCamel,
  rowToCamel,
  rowsToCamel,
  parsePagination,
  buildLikePattern
};
