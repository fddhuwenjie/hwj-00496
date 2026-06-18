/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import templateRoutes from './routes/templates.js'
import contractRoutes from './routes/contracts.js'
import signatureRoutes from './routes/signatures.js'
import statsRoutes from './routes/stats.js'
import reviewRoutes from './routes/review.js'
import nodeRoutes from './routes/nodes.js'
import './db.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api/contracts', contractRoutes)
app.use('/api/signatures', signatureRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/review', reviewRoutes)
app.use('/api/nodes', nodeRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
