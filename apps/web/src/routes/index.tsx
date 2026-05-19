import { createBrowserRouter, RouterProvider } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ContactPage from "../pages/ContactPage";
import ContactGroup from "../pages/ContactGroup";
import ContactRequest from "../pages/ContactRequest";
import ContactGroupRequest from "../pages/ContactGroupRequest";
import HomePage from "../pages/HomePage";
import ConversationPage from "../pages/ConversationPage";
import ProtectedRoute from "./ProtectedRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/conversation/:id",
        element: <ConversationPage />,
      },
      {
        path: "/conversations/:id",

        element: <ConversationPage />,
      },
      {
        path: "/contacts",
        element: <ContactPage />,
      },
      {
        path: "/contacts/groups",
        element: <ContactGroup />,
      },
      {
        path: "/contacts/requests",
        element: <ContactRequest />,
      },
      {
        path: "/contacts/group-requests",
        element: <ContactGroupRequest />,
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
