import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isBanned: boolean;
}

interface BanAppeal {
  id: string;
  userId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

const AdminDashboard: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [banStage, setBanStage] = useState('0');
  const [banReason, setBanReason] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [banAppeals, setBanAppeals] = useState<BanAppeal[]>([]);
  const [view, setView] = useState<'ban' | 'users' | 'pendingGames' | 'appeals'>('ban');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchBanAppeals();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchBanAppeals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/admin/ban-appeals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBanAppeals(response.data);
    } catch (error) {
      console.error('Error fetching ban appeals:', error);
    }
  };

  const handleBanUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/admin/ban`, 
        { userId, banStage: parseInt(banStage), reason: banReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('User banned successfully');
      setUserId('');
      setBanStage('0');
      setBanReason('');
      fetchUsers();
    } catch (error) {
      console.error('Error banning user:', error);
      alert('Failed to ban user. Please check the user ID and try again.');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/admin/unban`, 
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('User unbanned successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error unbanning user:', error);
      alert('Failed to unban user. Please try again.');
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/admin/promote`, 
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('User promoted to admin successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      alert('Failed to promote user to admin. Please try again.');
    }
  };

  const handleAppealAction = async (appealId: string, action: 'approve' | 'reject') => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/admin/ban-appeal/${appealId}`, 
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`Ban appeal ${action}ed successfully`);
      fetchBanAppeals();
    } catch (error) {
      console.error('Error handling ban appeal:', error);
      alert('Failed to process ban appeal');
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.id.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex space-x-2 mb-4">
        <Button onClick={() => setView('ban')}>Ban User</Button>
        <Button onClick={() => setView('users')}>Manage Users</Button>
        <Button onClick={() => setView('pendingGames')}>Pending Games</Button>
        <Button onClick={() => setView('appeals')}>Ban Appeals</Button>
      </div>

      {view === 'ban' && (
        <div>
          <h4 className="text-lg font-semibold mb-2">Ban User</h4>
          <Input 
            placeholder="User ID" 
            value={userId} 
            onChange={(e) => setUserId(e.target.value)} 
          />
          <Select onValueChange={(value: string) => setBanStage(value)}>
            <SelectTrigger>
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
      )}

      {view === 'users' && (
        <div>
          <h4 className="text-lg font-semibold mb-2">Manage Users</h4>
          <Input 
            placeholder="Search users..." 
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            className="mb-4"
          />
          <ul>
            {filteredUsers.map(user => (
              <li key={user.id} className="mb-2 flex items-center justify-between">
                <span>{user.name} ({user.email}) - ID: {user.id}</span>
                <div>
                  {user.isBanned ? (
                    <Button onClick={() => handleUnbanUser(user.id)} className="mr-2">Unban</Button>
                  ) : null}
                  {!user.isAdmin ? (
                    <Button onClick={() => handlePromoteToAdmin(user.id)}>Promote to Admin</Button>
                  ) : (
                    <span className="text-green-500 font-bold">Admin</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === 'pendingGames' && (
        <div>
          <h4 className="text-lg font-semibold mb-2">Pending Games</h4>
          <p>Pending Games functionality to be implemented.</p>
        </div>
      )}

      {view === 'appeals' && (
        <div>
          <h4 className="text-lg font-semibold mb-2">Ban Appeals</h4>
          {banAppeals.map(appeal => (
            <div key={appeal.id} className="mb-4 p-2 border rounded">
              <p>User ID: {appeal.userId}</p>
              <p>Reason: {appeal.reason}</p>
              <p>Status: {appeal.status}</p>
              {appeal.status === 'pending' && (
                <div className="mt-2">
                  <Button onClick={() => handleAppealAction(appeal.id, 'approve')} className="mr-2">Approve</Button>
                  <Button onClick={() => handleAppealAction(appeal.id, 'reject')}>Reject</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;