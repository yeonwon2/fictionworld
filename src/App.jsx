import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Characters from '@/pages/Characters';
import CharacterDetail from '@/pages/CharacterDetail';
import Relationships from '@/pages/Relationships';
import Locations from '@/pages/Locations';
import Timeline from '@/pages/Timeline';
import Workspace from '@/pages/Workspace';
import StoryMatrix from '@/pages/StoryMatrix';
import Worldbook from '@/pages/Worldbook';
import AICreative from '@/pages/AICreative';
import GameStudio from '@/pages/GameStudio';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/nhan-vat" element={<Characters />} />
          <Route path="/nhan-vat/:id" element={<CharacterDetail />} />
          <Route path="/so-do" element={<Relationships />} />
          <Route path="/dia-danh" element={<Locations />} />
          <Route path="/nien-bieu" element={<Timeline />} />
          <Route path="/soan-thao" element={<Workspace />} />
          <Route path="/cot-truyen" element={<StoryMatrix />} />
          <Route path="/so-tay-the-gioi" element={<Worldbook />} />
          <Route path="/sang-tac-ai" element={<AICreative />} />
          <Route path="/xuong-game" element={<GameStudio />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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