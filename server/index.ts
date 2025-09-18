//server/index.ts
import express from "express";
import { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import { Pool } from '@neondatabase/serverless';
import pgSession from "connect-pg-simple";
import gscRouter from './routes/gsc.routes';
import 'dotenv/config'; // must come before importing encryption-service
//nadagdag
import { schedulerService } from './services/scheduler-service';
import autoSchedulesRouter from "./api/user/auto-schedules";
// =============================================================================
// TYPE DECLARATIONS (moved to top)
// =============================================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email?: string;
        name?: string;
      };
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

// =============================================================================
// SESSION STORE CONFIGURATION
// =============================================================================

const PgSession = pgSession(session);
const sessionStore = new PgSession({
  pool: new Pool({ 
    connectionString: process.env.DATABASE_URL 
  }),
  tableName: 'sessions', // Uses your existing sessions table
  createTableIfMissing: false, // Table already exists in your schema
});

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

const app = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// =============================================================================
// SESSION CONFIGURATION (now AFTER app creation)
// =============================================================================

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'ai-seo-session',
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // CSRF protection
  },
  rolling: true, // Reset expiration on activity
}));

// =============================================================================
// LOGGING MIDDLEWARE
// =============================================================================

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// =============================================================================
// CORS CONFIGURATION (optional but recommended)
// =============================================================================
app.use('/api/gsc', requireAuth, gscRouter);


app.use((req: Request, res: Response, next: NextFunction) => {
  // Allow requests from your frontend domain
  const allowedOrigins = [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative dev port
    process.env.FRONTEND_URL, // Production frontend URL
  ].filter(Boolean);

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

(async () => {
  try {
    // Register all API routes
    const server = await registerRoutes(app);

     //nadagdag
    // ADD: Manual trigger endpoint for testing scheduler
    app.post('/api/admin/trigger-scheduler', async (req: Request, res: Response) => {
      try {
        // Check if user is authenticated
        if (!req.user) {
          return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        
        const result = await schedulerService.manualProcess();
        res.json({ 
          success: true, 
          message: 'Scheduler triggered manually',
          result 
        });
      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          message: error.message 
        });
      }
    });


    // Global error handler (must be after routes)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Global error handler:", err);
      
      // Don't expose internal error details in production
      const responseMessage = process.env.NODE_ENV === 'production' 
        ? status >= 500 ? 'Internal Server Error' : message
        : message;

      res.status(status).json({ 
        success: false,
        message: responseMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });

    // Setup Vite for development or serve static files for production
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Health check endpoint
    app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
      });
    });

    // 404 handler for unmatched routes
    app.use('*', (_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Server configuration
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = process.env.HOST || "0.0.0.0";

    server.listen({
      port,
      host,
    }, () => {
      log(`🚀 Server running on http://${host}:${port}`);
      log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔐 Session store: PostgreSQL`);
      log(`📡 API available at: http://${host}:${port}/api`);
      

            //nadagdag
      schedulerService.startScheduler(1); // Check every 1 minute
      log(`⏰ Content scheduler started - checking every minute for scheduled content`);
      

      if (process.env.NODE_ENV === 'development') {
        log(`🛠️  Development mode: Vite dev server enabled`);
      }
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
})();


app.use("/api/user/auto-schedules", autoSchedulesRouter);
// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

process.on('SIGTERM', () => {
  log('📴 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('📴 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});