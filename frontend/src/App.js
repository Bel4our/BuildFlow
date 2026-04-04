import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthContext, AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login'; 
import Register from './pages/Register'; 
import AdminDashboard from './pages/AdminDashboard';
import BuilderDashboard from './pages/BuilderDashboard';
import ClientDashboard from './pages/ClientDashboard';
import Profile from './pages/Profile';

const Navigation = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/" style={{ fontSize: '1.5em', fontWeight: 'bold' }}>BuildFlow</Link>
      </div>
      <div className="user-info">
        {!user ? (
          <>
            <Link to="/login">Вход</Link>
            <Link to="/register">Регистрация</Link>
          </>
        ) : (
          <>
            
            {user.role === 'Администратор' && <Link to="/admin">Панель Админа</Link>}
            {user.role === 'Прораб' && <Link to="/builder">Мои задачи</Link>}
            {user.role === 'Заказчик' && <Link to="/client">Мои проекты</Link>}
            
           
            <Link to="/profile" style={{ background: 'var(--primary-color)', color: '#222', padding: '5px 15px', borderRadius: '20px' }}>
              Личный кабинет
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <h2 style={{textAlign: 'center', marginTop: '50px'}}>Доступ запрещен!</h2>;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navigation />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

         
           <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['Администратор']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
           <Route path="/builder" element={
              <ProtectedRoute allowedRoles={['Прораб']}>
                <BuilderDashboard />
              </ProtectedRoute>
            } />
            <Route path="/client" element={
              <ProtectedRoute allowedRoles={['Заказчик']}>
                <ClientDashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;