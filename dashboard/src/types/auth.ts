export interface User {
  id: string;
  name: string;
  email: string;
}
export interface AuthResponse {
  token: string;
  user: User;
}
export interface ApiError {
  error: { code: string; message: string };
}
