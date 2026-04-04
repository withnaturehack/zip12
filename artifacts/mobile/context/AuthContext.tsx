import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";

const API_BASE: string =
  Platform.OS === "web"
    ? "/api"
    : (Constants.expoConfig?.extra?.apiUrl as string) ||
      process.env.EXPO_PUBLIC_API_URL ||
      "http://localhost:8080/api";

export type UserRole = "student" | "volunteer" | "coordinator" | "admin" | "superadmin" | "pending";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  rollNumber?: string;
  phone?: string;
  contactNumber?: string;
  area?: string;
  hostelId?: string;
  roomNumber?: string;
  assignedMess?: string;
  attendanceStatus?: string;
  isActive?: boolean;
  lastActiveAt?: string;
  assignedHostelIds?: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, rollNumber: string) => Promise<string>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isCoordinator: boolean;
  isVolunteer: boolean;
  isSuperAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, isLoading: true });

  useEffect(() => { loadStoredAuth(); }, []);

  async function loadStoredAuth() {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        const user = await fetchMe(token);
        if (user) { setState({ user, token, isLoading: false }); return; }
      }
    } catch {}
    setState(s => ({ ...s, isLoading: false }));
  }

  async function fetchMe(token: string): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");
    await AsyncStorage.setItem("token", data.token);
    const me = await fetchMe(data.token);
    setState({ user: me || data.user, token: data.token, isLoading: false });
  }

  // Returns a message string (for pending approval flow)
  async function register(name: string, email: string, password: string, rollNumber: string): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, rollNumber }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Registration failed");
    // Registration now returns pending — no token
    return data.message || "Registration submitted. Awaiting Super Admin approval.";
  }

  async function logout() {
    await AsyncStorage.removeItem("token");
    setState({ user: null, token: null, isLoading: false });
  }

  async function refreshUser() {
    if (!state.token) return;
    const user = await fetchMe(state.token);
    if (user) setState(s => ({ ...s, user }));
  }

  const role = state.user?.role;
  const isCoordinator = role === "coordinator" || role === "admin" || role === "superadmin";
  const isVolunteer = role === "volunteer" || isCoordinator;
  const isSuperAdmin = role === "superadmin";
  const isStudent = role === "student";

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, isCoordinator, isVolunteer, isSuperAdmin, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useApiRequest() {
  const { token } = useAuth();
  return useCallback(async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => { throw new Error("Invalid server response"); });
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }, [token]);
}
