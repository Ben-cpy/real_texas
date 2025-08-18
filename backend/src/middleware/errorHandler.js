const errorHandler = (error, req, res, next) => {
  console.error('错误详情:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  })

  // 数据库错误
  if (error.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({
      error: '数据约束错误',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }

  // JWT错误
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: '无效的访问令牌'
    })
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: '访问令牌已过期'
    })
  }

  // 验证错误
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: '数据验证失败',
      details: error.message
    })
  }

  // 默认错误
  res.status(error.status || 500).json({
    error: error.message || '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack 
    })
  })
}

export default errorHandler