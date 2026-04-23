import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthContext, AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login'; 
import Register from './pages/Register'; 
import AdminDashboard from './pages/AdminDashboard';
import BuilderDashboard from './pages/BuilderDashboard';
import ClientDashboard from './pages/ClientDashboard';
import Profile from './pages/Profile';
import ProjectDetails from './pages/ProjectDetails';
import MyTasks from './pages/MyTasks';

const Navigation = () => {
  const { user } = useContext(AuthContext);

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
            {user.role === 'Прораб' && <Link to="/builder">Мои Объекты</Link>}
            {user.role === 'Прораб' && <Link to="/my-tasks">Список Задач</Link>}
            {user.role === 'Заказчик' && <Link to="/client">Мои проекты</Link>}
            <Link to="/profile" className="profile-link">
              Личный кабинет
            </Link>
          </>
        )}
      </div>
    </nav>
  );
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
            
            <Route path="/project/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['Администратор']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/builder" element={<ProtectedRoute allowedRoles={['Прораб']}><BuilderDashboard /></ProtectedRoute>} />
            <Route path="/my-tasks" element={<ProtectedRoute allowedRoles={['Прораб']}><MyTasks /></ProtectedRoute>} />
            <Route path="/client" element={<ProtectedRoute allowedRoles={['Заказчик']}><ClientDashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;