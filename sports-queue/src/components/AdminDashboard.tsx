import React, { useState } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import axios from 'axios';
import { API_BASE_URL } from '../config/api';


const AdminDashboard: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [banStage, setBanStage] = useState('0');
  const [banReason, setBanReason] = useState('');
  
  const handleBanUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/admin/ban`, 
        { userId, banStage: parseInt(banStage), reason: banReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('User banned successfully');
    } catch (error) {
      console.error('Error banning user:', error);
      alert('Failed to ban user');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-semibold mb-2">Ban User</h4>
        <Input 
          placeholder="User ID" 
          value={userId} 
          onChange={(e) => setUserId(e.target.value)} 
        />
        <Select onValueChange={setBanStage}>
          <SelectTrigger className="w-full mt-2">
            <SelectValue placeholder="Select ban stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Warning</SelectItem>
            <SelectItem value="1">1 Day Ban</SelectItem>
            <SelectItem value="2">7 Day Ban</SelectItem>
            <SelectItem value="3">30 Day Ban</SelectItem>
            <SelectItem value="4">Permanent Ban</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          placeholder="Ban Reason" 
          value={banReason} 
          onChange={(e) => setBanReason(e.target.value)} 
          className="mt-2"
        />
        <Button onClick={handleBanUser} className="mt-2">Ban User</Button>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Other Admin Actions</h4>
        <Button className="mr-2">Manage Users</Button>
        <Button className="mr-2">View Reports</Button>
        <Button>System Settings</Button>
      </div>
    </div>
  );
};

export default AdminDashboard;