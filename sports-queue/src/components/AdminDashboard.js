import React from 'react';
import { Button } from "./ui/button";

const AdminDashboard = () => {
  console.log('Rendering AdminDashboard');
  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Admin Controls</h3>
      <div className="space-y-4">
        <Button>Manage Users</Button>
        <Button>View Reports</Button>
        <Button>System Settings</Button>
      </div>
    </div>
  );
};

export default AdminDashboard;