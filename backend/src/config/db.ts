import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('disconnected', () =>
  console.log('MongoDB disconnected'),
);
mongoose.connection.on('error', () =>
  console.error('MongoDB connection error'),
);

export async function connectDb(): Promise<void> {
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
