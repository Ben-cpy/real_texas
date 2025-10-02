import { exec } from 'child_process'
import { promisify } from 'util'
import net from 'net'

const execAsync = promisify(exec)

/**
 * Check if port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is available
 */
export async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false)
      } else {
        resolve(false)
      }
    })

    server.once('listening', () => {
      server.close()
      resolve(true)
    })

    server.listen(port, '0.0.0.0')
  })
}

/**
 * Find process ID using port on Windows
 * @param {number} port - Port number
 * @returns {Promise<string|null>} Process ID or null
 */
async function findProcessOnPort(port) {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
    const lines = stdout.split('\n')

    for (const line of lines) {
      // Look for LISTENING state
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && !isNaN(pid)) {
          return pid
        }
      }
    }
    return null
  } catch (error) {
    return null
  }
}

/**
 * Kill process by PID on Windows
 * @param {string} pid - Process ID
 * @returns {Promise<boolean>} True if successful
 */
async function killProcess(pid) {
  try {
    await execAsync(`taskkill /PID ${pid} /F`)
    console.log(`Successfully killed process ${pid}`)
    return true
  } catch (error) {
    console.error(`Failed to kill process ${pid}:`, error.message)
    return false
  }
}

/**
 * Clear port by killing the process using it
 * @param {number} port - Port number to clear
 * @param {boolean} force - Force kill without asking
 * @returns {Promise<boolean>} True if successful
 */
export async function clearPort(port, force = false) {
  console.log(`Checking if port ${port} is in use...`)

  const available = await isPortAvailable(port)
  if (available) {
    console.log(`Port ${port} is already available`)
    return true
  }

  console.log(`Port ${port} is in use, attempting to free it...`)

  const pid = await findProcessOnPort(port)
  if (!pid) {
    console.error(`Could not find process using port ${port}`)
    return false
  }

  console.log(`Found process ${pid} using port ${port}`)

  if (force) {
    return await killProcess(pid)
  } else {
    console.log(`To kill this process, run: taskkill /PID ${pid} /F`)
    return false
  }
}

/**
 * Find next available port starting from given port
 * @param {number} startPort - Starting port number
 * @param {number} maxAttempts - Maximum number of ports to try
 * @returns {Promise<number|null>} Available port or null
 */
export async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i
    const available = await isPortAvailable(port)
    if (available) {
      return port
    }
  }
  return null
}

/**
 * Ensure port is available, with auto-cleanup option
 * @param {number} port - Preferred port
 * @param {Object} options - Options
 * @param {boolean} options.autoClear - Auto clear port if occupied
 * @param {boolean} options.findAlternative - Find alternative port if occupied
 * @returns {Promise<Object>} Result with port and status
 */
export async function ensurePort(port, options = {}) {
  const { autoClear = false, findAlternative = true } = options

  // Check if port is available
  const available = await isPortAvailable(port)
  if (available) {
    return {
      success: true,
      port,
      message: `Port ${port} is available`
    }
  }

  console.log(`Port ${port} is occupied`)

  // Try to clear port if autoClear is enabled
  if (autoClear) {
    console.log(`Attempting to clear port ${port}...`)
    const cleared = await clearPort(port, true)

    if (cleared) {
      // Wait a bit for port to be released
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check again
      const nowAvailable = await isPortAvailable(port)
      if (nowAvailable) {
        return {
          success: true,
          port,
          message: `Port ${port} was cleared and is now available`,
          wasCleared: true
        }
      }
    }
  }

  // Find alternative port if enabled
  if (findAlternative) {
    console.log(`Searching for alternative port...`)
    const alternativePort = await findAvailablePort(port + 1, 10)

    if (alternativePort) {
      return {
        success: true,
        port: alternativePort,
        message: `Using alternative port ${alternativePort}`,
        wasAlternative: true
      }
    }
  }

  // Failed to secure a port
  return {
    success: false,
    port: null,
    message: `Port ${port} is occupied and could not be cleared. Please manually close the application using this port.`,
    error: 'PORT_OCCUPIED'
  }
}

/**
 * Get port information
 * @param {number} port - Port number
 * @returns {Promise<Object>} Port information
 */
export async function getPortInfo(port) {
  const available = await isPortAvailable(port)

  if (available) {
    return {
      port,
      available: true,
      process: null
    }
  }

  const pid = await findProcessOnPort(port)
  let processName = null

  if (pid) {
    try {
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`)
      const match = stdout.match(/"([^"]+)"/)
      if (match) {
        processName = match[1]
      }
    } catch (error) {
      // Ignore error
    }
  }

  return {
    port,
    available: false,
    process: {
      pid,
      name: processName
    }
  }
}
