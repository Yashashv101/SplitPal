import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import GroupDetailPage from './pages/GroupDetailPage';
import Navbar from './components/Navbar';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

function App() {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API_URL}/groups`);
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const addGroup = async (groupData) => {
    try {
      const response = await axios.post(`${API_URL}/groups`, groupData);
      setGroups([...groups, response.data]);
      return response.data;
    } catch (error) {
      console.error('Error adding group:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage groups={groups} addGroup={addGroup} />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;