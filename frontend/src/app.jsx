import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ChatPage from './pages/Chat';
import Homepage from './pages/Homepage';
import KnowledgePage from './pages/Knowledge';
import User from './pages/User';
import Login from './pages/Login';
import Register from './pages/Register';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastProvider } from './components/common/Toast';
import { useAuthStore } from './stores/authStore';
import { useEffect, useState } from 'react';

const PrivateRoute = ({ children, allowGuest = true }) => {
  const { isAuthenticated, isGuest } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const currentUser = localStorage.getItem('heritage_current_user');

      if (token && currentUser) {
        try {
          const user = JSON.parse(currentUser);
          useAuthStore.getState().setUserFromStorage(user, token);
        } catch {
          console.warn('Failed to parse stored user');
        }
      }
      setChecking(false);
    };

    checkAuth();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b89259]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isGuest && !allowGuest) {
    return <Navigate to="/login" replace state={{ message: '此功能需要登录账号才能使用' }} />;
  }

  return children;
};

const GuestAllowedRoute = ({ children }) => {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const currentUser = localStorage.getItem('heritage_current_user');

      if (token && currentUser) {
        try {
          const user = JSON.parse(currentUser);
          useAuthStore.getState().setUserFromStorage(user, token);
        } catch {
          console.warn('Failed to parse stored user');
        }
      }
      setChecking(false);
    };

    checkAuth();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b89259]"></div>
      </div>
    );
  }

  return children;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/" element={<MainLayout />}>
              <Route index element={<Homepage />} />

              <Route
                path="chat"
                element={
                  <GuestAllowedRoute>
                    <ChatPage />
                  </GuestAllowedRoute>
                }
              />
              <Route
                path="chat/:sessionId"
                element={
                  <GuestAllowedRoute>
                    <ChatPage />
                  </GuestAllowedRoute>
                }
              />
              <Route
                path="knowledge"
                element={
                  <GuestAllowedRoute>
                    <KnowledgePage />
                  </GuestAllowedRoute>
                }
              />

              <Route
                path="user"
                element={
                  <PrivateRoute allowGuest={false}>
                    <User />
                  </PrivateRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
