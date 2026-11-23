import { createBrowserRouter, redirect } from "react-router-dom";
import { checkAuth, UserRole } from "./auth";
import Layout from "./pages/Layout";
import DashboardPage from "./pages/DashboardPage";
import CamerasPage from "./pages/CamerasPage";
import TrafficPage from "./pages/TrafficPage";
import ConversionPage from "./pages/ConversionPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { StoreStatusPage } from "./pages/StoreStatusPage";

async function redirectIfAuthenticated() {
  const user = await checkAuth();
  return user ? redirect("/") : null;
}

async function requireAuth() {
  const user = await checkAuth();
  return user ? null : redirect("/login");
}

function requireRole(allowedRoles: UserRole[]) {
  return async () => {
    const user = await checkAuth();
    if (!user) {
      return redirect("/login");
    }
    if (!allowedRoles.includes(user.role)) {
      return redirect("/");
    }
    return null;
  };
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    loader: redirectIfAuthenticated,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
    loader: redirectIfAuthenticated,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
    loader: redirectIfAuthenticated,
  },
  {
    path: "/store-status",
    element: <StoreStatusPage />,
  },
  {
    path: "/",
    element: <Layout />,
    loader: requireAuth,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "cameras", element: <CamerasPage /> },
      { path: "traffic", element: <TrafficPage /> },
      { path: "conversion", element: <ConversionPage /> },
      { path: "reports", element: <ReportsPage /> },
      {
        path: "settings",
        element: <SettingsPage />,
        loader: requireRole(["admin"]),
      },
    ],
  },
  {
    path: "*",
    loader: async () => {
      const user = await checkAuth();
      return redirect(user ? "/" : "/login");
    },
  },
]);