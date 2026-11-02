import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mongo } from 'mongoose';
import { env } from '../config/env.js';
import { User, toAuthUser, type AuthUser } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

// Generated once per process, with the same cost as real passwords.
const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);

function authResult(user: AuthUser) {
  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
  return { token, user };
}

export async function register(name: string, email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({
      name,
      email: email.trim().toLowerCase(),
      passwordHash,
    });
    return authResult(toAuthUser(user));
  } catch (error) {
    if (error instanceof mongo.MongoServerError && error.code === 11000) {
      throw new AppError('Email is already registered', 409, 'EMAIL_TAKEN');
    }
    throw error;
  }
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    '+passwordHash',
  );
  const matches = await bcrypt.compare(
    password,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !matches) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  return authResult(toAuthUser(user));
}
