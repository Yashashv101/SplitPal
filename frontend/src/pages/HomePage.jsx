import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

function HomePage() {
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

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

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      await axios.post(`${API_URL}/groups`, { name: newGroupName });
      setNewGroupName('');
      setShowCreateModal(false);
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Groups</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          Create Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-4">You don't have any groups yet</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link 
              key={group.id} 
              to={`/groups/${group.id}`}
              className="card hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{group.name}</h2>
              <div className="flex justify-between text-sm text-gray-500">
                <span>{group.members_count || 0} members</span>
                <span>{new Date(group.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Group</h2>
            <form onSubmit={createGroup}>
              <div className="mb-4">
                <label htmlFor="groupName" className="block text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="form-input"
                  placeholder="Enter group name"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;