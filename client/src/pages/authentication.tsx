

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Lock, User, Mail, LogOut } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   INLINE SANITIZERS (gentle-on-change, stricter-on-submit)
   - We avoid mutating passwords inline; only trim at submit.
   - Username: letters, numbers, underscores, dots, dashes; collapse spaces.
   - Email: trim, collapse spaces, lowercase.
   - Name: strip control chars and angle brackets; collapse whitespace.
───────────────────────────────────────────────────────────── */

const stripControl = (s: string) => (s ?? "").replace(/[\u0000-\u001F\u007F]/g, "");
const escapeAngles = (s: string) => s.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
const collapseSpaces = (s: string) => s.replace(/\s+/g, " ");

const sanitizeUsernameInline = (s: string) => {
  // allow letters, numbers, underscore, dot, dash; convert inner spaces to dash
  const base = stripControl(s).trim();
  const spaceCollapsed = base.replace(/\s+/g, "-");
  return spaceCollapsed.replace(/[^a-zA-Z0-9._-]/g, "");
};

const sanitizeUsernameFinal = (s: string) => sanitizeUsernameInline(s).toLowerCase();

const sanitizeEmailInline = (s: string) => collapseSpaces(stripControl(s)).trim().toLowerCase();
const sanitizeEmailFinal = (s: string) => sanitizeEmailInline(s);

const sanitizeNameInline = (s: string) => collapseSpaces(escapeAngles(stripControl(s))).trim();
const sanitizeNameFinal = (s: string) => sanitizeNameInline(s);

/* ─────────────────────────────────────────────────────────── */

// Types
interface User {
  id: string;
  username: string;
  email?: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (
    username: string,
    password: string,
    email?: string,
    name?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

// Auth Context
const AuthContext = React.createContext<AuthContextType | null>(null);

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    if (data.success && data.user) {
      setUser(data.user);
      // REMOVED: No forced redirect - let React handle navigation
    } else {
      throw new Error("Login failed - invalid response");
    }
  };

  const signup = async (
    username: string,
    password: string,
    email?: string,
    name?: string
  ) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password, email, name }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.errors ? data.errors.join(", ") : data.message;
      throw new Error(errorMessage || "Signup failed");
    }

    if (data.success && data.user) {
      setUser(data.user);
      // REMOVED: No forced redirect - let React handle navigation
    } else {
      throw new Error("Signup failed - invalid response");
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      // Ignore logout request errors
    } finally {
      setUser(null);
      // REMOVED: No forced redirect - just update state
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return {
    ...context,
    isAuthenticated: !!context.user, // ADD THIS
    isLoading: context.loading, // ADD THIS (rename loading to isLoading)
  };
}

// Login/Signup Component
export function AuthPage() {
  const { login, signup } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login state
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  // Signup state
  const [signupForm, setSignupForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    name: "",
  });

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // FINAL sanitize before request
      const username = sanitizeUsernameFinal(loginForm.username);
      const password = (loginForm.password ?? "").trim(); // don't mutate inline, just trim here

      await login(username, password);
      // Success - user state updates
    } catch (error: any) {
      setError(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setError("");

    if (!signupForm.username || !signupForm.password) {
      setError("Please fill in all required fields");
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (signupForm.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      // FINAL sanitize before request
      const username = sanitizeUsernameFinal(signupForm.username);
      const password = (signupForm.password ?? "").trim();
      const email = signupForm.email ? sanitizeEmailFinal(signupForm.email) : undefined;
      const name = signupForm.name ? sanitizeNameFinal(signupForm.name) : undefined;

      await signup(username, password, email, name);
      // Success - user state updates
    } catch (error: any) {
      setError(error.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Lock className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            AI SEO Content Platform
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Manage your websites with AI-powered SEO and content generation
          </p>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="login-username">Username</Label>
                    <div className="relative">
                      <Input
                        id="login-username"
                        type="text"
                        value={loginForm.username}
                        onChange={(e) =>
                          setLoginForm((prev) => ({
                            ...prev,
                            // INLINE sanitize while typing (gentle)
                            username: sanitizeUsernameInline(e.target.value),
                          }))
                        }
                        className="pl-10"
                        placeholder="Enter your username"
                      />
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={loginForm.password}
                        onChange={(e) =>
                          setLoginForm((prev) => ({
                            ...prev,
                            // Do NOT sanitize aggressively inline; just keep as typed
                            password: e.target.value,
                          }))
                        }
                        className="pl-10 pr-10"
                        placeholder="Enter your password"
                      />
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleLogin}
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="signup-username">Username *</Label>
                    <div className="relative">
                      <Input
                        id="signup-username"
                        type="text"
                        value={signupForm.username}
                        onChange={(e) =>
                          setSignupForm((prev) => ({
                            ...prev,
                            username: sanitizeUsernameInline(e.target.value),
                          }))
                        }
                        className="pl-10"
                        placeholder="Choose a username"
                      />
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Input
                        id="signup-email"
                        type="email"
                        value={signupForm.email}
                        onChange={(e) =>
                          setSignupForm((prev) => ({
                            ...prev,
                            email: sanitizeEmailInline(e.target.value),
                          }))
                        }
                        className="pl-10"
                        placeholder="your@email.com (optional)"
                      />
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupForm.name}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          name: sanitizeNameInline(e.target.value),
                        }))
                      }
                      placeholder="Your full name (optional)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="signup-password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        value={signupForm.password}
                        onChange={(e) =>
                          setSignupForm((prev) => ({
                            ...prev,
                            password: e.target.value, // keep as typed; trim at submit
                          }))
                        }
                        className="pl-10 pr-10"
                        placeholder="At least 6 characters"
                      />
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="signup-confirm">Confirm Password *</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      value={signupForm.confirmPassword}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value, // keep as typed
                        }))
                      }
                      placeholder="Confirm your password"
                    />
                  </div>

                  <Button
                    onClick={handleSignup}
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// User Menu Component (Fixed - no forced reloads)
export function CompactSidebarUserMenu() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const handleLogoutClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmLogout = async () => {
    setShowConfirmation(false);
    setIsLoggingOut(true);
    try {
      await logout();
      // No forced redirect - React will handle the state change
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCancelLogout = () => {
    setShowConfirmation(false);
  };

  const displayName = user.name || user.username;

  return (
    <>
      <div className="px-4 py-3 border-t border-gray-200 mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="relative">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                {getInitials(displayName)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border border-white rounded-full"></div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 text-xs truncate">
                {displayName}
              </div>
              <div className="text-xs text-gray-500">Pro Plan</div>
            </div>
          </div>

          <button
            onClick={handleLogoutClick}
            disabled={isLoggingOut}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isLoggingOut ? "Signing Out..." : "Sign Out"}
          >
            {isLoggingOut ? (
              <div className="w-4 h-4 border border-red-300 border-t-red-600 rounded-full animate-spin"></div>
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sign Out
                </h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to sign out?
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCancelLogout}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Protected Route Component
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <>{children}</>;
}

export default {
  AuthProvider,
  useAuth,
  AuthPage,
  CompactSidebarUserMenu,
  ProtectedRoute,
};
