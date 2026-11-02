import type { RequestHandler } from 'express';
import * as authService from '../services/authService.js';
import { AppError } from '../utils/AppError.js';

export const register: RequestHandler = async (req, res) => {
  const { name, email, password } = req.body;
  res.status(201).json(await authService.register(name, email, password));
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body;
  res.json(await authService.login(email, password));
};

export const me: RequestHandler = (req, res) => {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  res.json({ user: req.user });
};
