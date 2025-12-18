import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";
import connectPg from "connect-pg-simple";
import { z } from "zod";
import { pool } from "./db";
import { db } from "./db";
import { passwordResetTokens, users } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "expedition-group-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax",
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));

  // Register endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(parsed.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(parsed.password, saltRounds);

      // Create user
      const user = await storage.createUser({
        email: parsed.email,
        passwordHash,
        firstName: parsed.firstName || null,
        lastName: parsed.lastName || null,
        role: "client",
      });

      // Set session
      req.session.userId = user.id;

      res.status(201).json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.parse(req.body);
      console.log("Login attempt for:", parsed.email);
      
      // Find user by email
      const user = await storage.getUserByEmail(parsed.email);
      console.log("User found:", user ? "yes" : "no", "Has password:", user?.passwordHash ? "yes" : "no");
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
      console.log("Password valid:", isValid);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      req.session.userId = user.id;

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Forgot password endpoint (public - for requesting password reset)
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const forgotSchema = z.object({
        email: z.string().email("Invalid email address"),
      });

      const parsed = forgotSchema.parse(req.body);

      // Always return success to prevent email enumeration
      const user = await storage.getUserByEmail(parsed.email);
      
      if (user) {
        // Generate a secure random token
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = await bcrypt.hash(token, 10);
        
        // Token expires in 30 minutes
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        // Store the token
        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt,
        });

        // In production, you would send an email here
        // For now, log the reset link (in dev only)
        const resetLink = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/reset-password?token=${token}`;
        console.log("Password reset link for", parsed.email, ":", resetLink);
      }

      // Always return success to prevent email enumeration
      res.json({ message: "If an account exists with that email, password reset instructions have been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Validate reset token endpoint
  app.get("/api/auth/validate-reset-token", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Find valid tokens (not expired and not used)
      const tokens = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            gt(passwordResetTokens.expiresAt, new Date()),
            isNull(passwordResetTokens.usedAt)
          )
        );

      // Check if any token matches
      for (const tokenRecord of tokens) {
        const isValid = await bcrypt.compare(token, tokenRecord.tokenHash);
        if (isValid) {
          return res.json({ valid: true });
        }
      }

      return res.status(400).json({ message: "Invalid or expired token" });
    } catch (error) {
      console.error("Validate token error:", error);
      res.status(500).json({ message: "Failed to validate token" });
    }
  });

  // Public password reset endpoint (using token)
  app.post("/api/auth/reset-password-with-token", async (req: Request, res: Response) => {
    try {
      const resetSchema = z.object({
        token: z.string(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });

      const parsed = resetSchema.parse(req.body);

      // Find valid tokens (not expired and not used)
      const tokens = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            gt(passwordResetTokens.expiresAt, new Date()),
            isNull(passwordResetTokens.usedAt)
          )
        );

      // Check if any token matches
      let validTokenRecord = null;
      for (const tokenRecord of tokens) {
        const isValid = await bcrypt.compare(parsed.token, tokenRecord.tokenHash);
        if (isValid) {
          validTokenRecord = tokenRecord;
          break;
        }
      }

      if (!validTokenRecord) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(parsed.password, saltRounds);

      // Update user password
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, validTokenRecord.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, validTokenRecord.id));

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Admin password reset endpoint
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is admin
      const currentUser = await storage.getUser(req.session.userId);
      if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
        return res.status(403).json({ message: "Only admins can reset passwords" });
      }

      const resetSchema = z.object({
        userId: z.string(),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      });

      const parsed = resetSchema.parse(req.body);

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(parsed.newPassword, saltRounds);

      // Update user password
      const updatedUser = await storage.updateUserPassword(parsed.userId, passwordHash);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}
