import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../server.js';
import { config } from '../config/index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, registerSchema, loginSchema } from '../middleware/validation.js';

const router = Router();

// Generate JWT
const generateToken = (userId: string, email: string): string => {
  const options: SignOptions = { expiresIn: '7d' };
  return jwt.sign(
    { userId, email },
    config.jwtSecret,
    options
  );
};

// Register - Creates a pending account that needs admin approval
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
    
    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email
          ? 'Email already registered'
          : 'Username already taken',
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if this is the admin email - auto-approve admin
    const isAdmin = email === config.adminEmail;
    
    // Create user - auto-approve if admin, otherwise pending approval
    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        isAdmin,
        isApproved: isAdmin, // Admin is auto-approved
        money: 1000, // Starting money
      },
    });
    
    // Don't return token - account needs approval first (unless admin)
    res.status(201).json({ 
      success: true,
      message: isAdmin 
        ? 'Compte admin créé avec succès' 
        : 'Demande envoyée ! Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.',
      requiresApproval: !isAdmin,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if account is approved
    if (!user.isApproved) {
      return res.status(403).json({ 
        error: 'Votre compte est en attente d\'approbation par un administrateur.',
        pendingApproval: true,
      });
    }
    
    const token = generateToken(user.id, user.email);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        aura: user.aura,
        money: user.money,
        isAdmin: user.isAdmin,
        usernameColor: user.usernameColor,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Refresh token
router.post('/refresh', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const token = generateToken(req.user.id, req.user.email);
    res.json({ token });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        aura: true,
        money: true,
        isAdmin: true,
        usernameColor: true,
        profilePicture: true,
        createdAt: true,
      },
    });
    
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
