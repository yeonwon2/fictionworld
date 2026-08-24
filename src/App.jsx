import React, { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Add page imports here

const WritingFactory = lazy(() => import('@/pages/WritingFactory'));
const GameStudio = lazy(() => import('@/pages/GameStudio'));
const GameScriptProject = lazy(() => import('@/pages/GameScriptProject'));

const lazyPage = (node) => (
  <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Đang mở xưởng...</div>}>
    {node}
  </Suspense>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();
  const { pathname } = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Bọc trong ErrorBoundary — key theo pathname để tự reset khi chuyển
  // trang, tránh lỗi ở 1 trang làm trắng luôn cả app cho đến khi F5.
  return (
    <ErrorBoundary key={pathname}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/nhan-vat/*" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/so-do" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/dia-danh" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/nien-bieu" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/soan-thao" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/cot-truyen" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/so-tay-the-gioi" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/sang-tac-ai" element={<Navigate to="/xuong-viet-truyen" replace />} />
          <Route path="/xuong-viet-truyen" element={lazyPage(<WritingFactory />)} />
          <Route path="/xuong-game" element={lazyPage(<GameStudio />)} />
          <Route path="/xuong-kich-ban-game" element={lazyPage(<GameScriptProject />)} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </ErrorBoundary>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
