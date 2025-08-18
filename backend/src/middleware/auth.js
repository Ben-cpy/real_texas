import jwt from 'jsonwebtoken'

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ 
      error: '访问被拒绝，需要有效的访问令牌' 
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: '无效的访问令牌' 
      })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        error: '访问令牌已过期' 
      })
    }

    console.error('Token验证错误:', error)
    return res.status(500).json({ 
      error: '服务器内部错误' 
    })
  }
}

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    req.user = null
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    req.user = null
    next()
  }
}