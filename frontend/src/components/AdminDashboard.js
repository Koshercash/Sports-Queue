import React, { useContext } from 'react';
import { UserContext } from '../contexts/UserContext';

const AdminDashboard = () => {
  const { user } = useContext(UserContext);

  if (!user || !user.isAdmin) {
    return <div>Access Denied</div>;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {/* Add admin-specific components here */}
    </div>
  );
};

export default AdminDashboard;