const jwt = require('jsonwebtoken');
const { error } = require('../utils/helper');

const JWT_SECRET = process.env.JWT_SECRET || 'eqdm_promax_secret_key_2026';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json(error('未提供认证令牌', 401));
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json(error('认证令牌无效或已过期', 401));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json(error('权限不足', 403));
    }
    next();
  };
}

module.exports = {
  generateToken,
  authMiddleware,
  requireRole
};
