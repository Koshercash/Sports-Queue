import React, { useContext } from 'react';
import { UserContext } from '../contexts/UserContext';
import AdminDashboard from './AdminDashboard';

function MainScreen() {
  const { user } = useContext(UserContext);

  return (
    <div>
      {/* ... other components ... */}
      {user && user.isAdmin && <AdminDashboard />}
    </div>
  );
}

export default MainScreen;