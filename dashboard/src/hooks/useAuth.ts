import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is required");
  return auth;
}
