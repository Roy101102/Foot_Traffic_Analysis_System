import { isAuthenticated } from "./auth";
import { createBrowserRouter, redirect } from "react-router-dom";
import Layout from "./pages/Layout";
import DashboardPage from "./pages/DashboardPage";
import CamerasPage from "./pages/CamerasPage";
import TrafficPage from "./pages/TrafficPage";
import ConversionPage from "./pages/ConversionPage";
import ReportsPage from "./pages/ReportsPage";
import AlertsPage from "./pages/AlertsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    loader: () => (isAuthenticated() ? redirect("/") : null),
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
    loader: () => (isAuthenticated() ? redirect("/") : null),
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
    loader: () => (isAuthenticated() ? redirect("/") : null),
  },
  {
    path: "/",
    element: <Layout />,
    loader: () => (!isAuthenticated() ? redirect("/login") : null),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "cameras", element: <CamerasPage /> },
      { path: "traffic", element: <TrafficPage /> },
      { path: "conversion", element: <ConversionPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    loader: () => redirect(isAuthenticated() ? "/" : "/login"),
  },
]);