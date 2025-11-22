// src/renderer/App.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, Plus, Edit2, Trash2, Terminal, Upload, 
  FolderOpen, X, Check, AlertCircle, Loader
} from 'lucide-react';
import './App.css';

interface SSHClient {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  snippet?: string;
}

interface CommandGroup {
  id: string;
  name: string;
  commands: Command[];
}

interface Command {
  id: string;
  name: string;
  content: string;
}

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

const App: React.FC = () => {
  const [clients, setClients] = useState<SSHClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<SSHClient | null>(null);
  const [commandGroups, setCommandGroups] = useState<{ [clientId: string]: CommandGroup[] }>({});
  const [showClientModal, setShowClientModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [showCommandView, setShowCommandView] = useState(false);
  const [editingClient, setEditingClient] = useState<SSHClient | null>(null);
  const [editingGroup, setEditingGroup] = useState<CommandGroup | null>(null);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [viewingCommand, setViewingCommand] = useState<Command | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const storedClients = await window.electron.store.get('ssh-clients');
    const storedCommands = await window.electron.store.get('command-groups');
    if (storedClients) setClients(storedClients);
    if (storedCommands) setCommandGroups(storedCommands);
  };

  const saveClients = async (newClients: SSHClient[]) => {
    await window.electron.store.set('ssh-clients', newClients);
    setClients(newClients);
  };

  const saveCommandGroups = async (newGroups: { [clientId: string]: CommandGroup[] }) => {
    await window.electron.store.set('command-groups', newGroups);
    setCommandGroups(newGroups);
  };

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleAddClient = (client: Omit<SSHClient, 'id'>) => {
    const newClient = { ...client, id: Date.now().toString() };
    saveClients([...clients, newClient]);
    showToast('SSH Client đã được thêm', 'success');
  };

  const handleEditClient = (client: SSHClient) => {
    saveClients(clients.map(c => c.id === client.id ? client : c));
    showToast('SSH Client đã được cập nhật', 'success');
  };

  const handleDeleteClient = (id: string) => {
    saveClients(clients.filter(c => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);
    showToast('SSH Client đã được xóa', 'success');
  };

  const handleAddGroup = (name: string) => {
    if (!selectedClient) return;
    const newGroup: CommandGroup = {
      id: Date.now().toString(),
      name,
      commands: []
    };
    const updated = {
      ...commandGroups,
      [selectedClient.id]: [...(commandGroups[selectedClient.id] || []), newGroup]
    };
    saveCommandGroups(updated);
    showToast('Nhóm command đã được thêm', 'success');
  };

  const handleEditGroup = (group: CommandGroup) => {
    if (!selectedClient) return;
    const updated = {
      ...commandGroups,
      [selectedClient.id]: (commandGroups[selectedClient.id] || []).map(g => 
        g.id === group.id ? group : g
      )
    };
    saveCommandGroups(updated);
    showToast('Nhóm command đã được cập nhật', 'success');
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!selectedClient) return;
    const updated = {
      ...commandGroups,
      [selectedClient.id]: (commandGroups[selectedClient.id] || []).filter(g => g.id !== groupId)
    };
    saveCommandGroups(updated);
    showToast('Nhóm command đã được xóa', 'success');
  };

  const handleAddCommand = (command: Omit<Command, 'id'>) => {
    if (!selectedClient || !currentGroupId) return;
    const newCommand = { ...command, id: Date.now().toString() };
    const updated = {
      ...commandGroups,
      [selectedClient.id]: (commandGroups[selectedClient.id] || []).map(g => 
        g.id === currentGroupId ? { ...g, commands: [...g.commands, newCommand] } : g
      )
    };
    saveCommandGroups(updated);
    showToast('Command đã được thêm', 'success');
  };

  const handleEditCommand = (command: Command) => {
    if (!selectedClient || !currentGroupId) return;
    const updated = {
      ...commandGroups,
      [selectedClient.id]: (commandGroups[selectedClient.id] || []).map(g => 
        g.id === currentGroupId 
          ? { ...g, commands: g.commands.map(c => c.id === command.id ? command : c) }
          : g
      )
    };
    saveCommandGroups(updated);
    showToast('Command đã được cập nhật', 'success');
  };

  const handleDeleteCommand = (groupId: string, commandId: string) => {
    if (!selectedClient) return;
    const updated = {
      ...commandGroups,
      [selectedClient.id]: (commandGroups[selectedClient.id] || []).map(g => 
        g.id === groupId ? { ...g, commands: g.commands.filter(c => c.id !== commandId) } : g
      )
    };
    saveCommandGroups(updated);
    showToast('Command đã được xóa', 'success');
  };

  const handleExecuteCommand = async (command: Command) => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const result = await window.electron.ssh.execute(selectedClient, command.content);
      if (result.success) {
        showToast('Command đã được thực thi thành công', 'success');
      } else {
        showToast(`Lỗi: ${result.message}`, 'error');
      }
    } catch (error: any) {
      showToast(`Lỗi: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!selectedClient || files.length === 0) return;
    setLoading(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const remotePath = `/tmp/${file.name}`;
        await window.electron.sftp.upload(selectedClient, file.path, remotePath);
        showToast(`${file.name} đã được upload thành công`, 'success');
      } catch (error: any) {
        showToast(`Lỗi upload ${file.name}: ${error.message}`, 'error');
      }
    }
    
    setLoading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="app">
      {/* Toast notifications */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`toast toast-${toast.type}`}
            >
              {toast.type === 'success' && <Check size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'info' && <AlertCircle size={18} />}
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <Loader className="spinner" size={40} />
        </div>
      )}

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <Terminal size={24} />
          <h1>Flink Manager</h1>
        </div>
        
        <div className="sidebar-section">
          <div className="section-header">
            <Server size={18} />
            <span>SSH Clients</span>
            <button 
              className="icon-btn"
              onClick={() => {
                setEditingClient(null);
                setShowClientModal(true);
              }}
            >
              <Plus size={18} />
            </button>
          </div>
          
          <div className="client-list">
            {clients.map(client => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`client-item ${selectedClient?.id === client.id ? 'active' : ''}`}
                onClick={() => setSelectedClient(client)}
              >
                <div className="client-info">
                  <div className="client-name">{client.name}</div>
                  <div className="client-host">{client.host}</div>
                </div>
                <div className="client-actions">
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingClient(client);
                      setShowClientModal(true);
                    }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClient(client.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {selectedClient ? (
          <>
            <div className="content-header">
              <h2>{selectedClient.name}</h2>
              <div className="header-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowGroupModal(true)}
                >
                  <Plus size={18} />
                  Thêm nhóm
                </button>
              </div>
            </div>

            <div className="command-groups">
              {(commandGroups[selectedClient.id] || []).map(group => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="command-group"
                >
                  <div className="group-header">
                    <FolderOpen size={20} />
                    <h3>{group.name}</h3>
                    <div className="group-actions">
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setCurrentGroupId(group.id);
                          setEditingCommand(null);
                          setShowCommandModal(true);
                        }}
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditingGroup(group);
                          setShowGroupModal(true);
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="command-list">
                    {group.commands.map(command => (
                      <motion.div
                        key={command.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="command-item"
                        onDoubleClick={() => {
                          setViewingCommand(command);
                          setShowCommandView(true);
                        }}
                      >
                        <div className="command-name">{command.name}</div>
                        <div className="command-actions">
                          <button
                            className="btn btn-small btn-primary"
                            onClick={() => handleExecuteCommand(command)}
                          >
                            <Terminal size={14} />
                            Chạy
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setCurrentGroupId(group.id);
                              setEditingCommand(command);
                              setShowCommandModal(true);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => handleDeleteCommand(group.id, command.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Upload section */}
            <div className="upload-section">
              <div
                className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <Upload size={40} />
                <p>Kéo thả file vào đây hoặc</p>
                <label className="btn btn-secondary">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    style={{ display: 'none' }}
                  />
                  Chọn file
                </label>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Server size={80} />
            <h2>Chọn SSH Client</h2>
            <p>Vui lòng chọn một SSH client từ sidebar để bắt đầu</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ClientModal
        isOpen={showClientModal}
        client={editingClient}
        onClose={() => {
          setShowClientModal(false);
          setEditingClient(null);
        }}
        onSave={(client) => {
          if (editingClient) {
            handleEditClient({ ...client, id: editingClient.id });
          } else {
            handleAddClient(client);
          }
          setShowClientModal(false);
          setEditingClient(null);
        }}
      />

      <GroupModal
        isOpen={showGroupModal}
        group={editingGroup}
        onClose={() => {
          setShowGroupModal(false);
          setEditingGroup(null);
        }}
        onSave={(name) => {
          if (editingGroup) {
            handleEditGroup({ ...editingGroup, name });
          } else {
            handleAddGroup(name);
          }
          setShowGroupModal(false);
          setEditingGroup(null);
        }}
      />

      <CommandModal
        isOpen={showCommandModal}
        command={editingCommand}
        onClose={() => {
          setShowCommandModal(false);
          setEditingCommand(null);
        }}
        onSave={(command) => {
          if (editingCommand) {
            handleEditCommand({ ...command, id: editingCommand.id });
          } else {
            handleAddCommand(command);
          }
          setShowCommandModal(false);
          setEditingCommand(null);
        }}
      />

      <CommandViewModal
        isOpen={showCommandView}
        command={viewingCommand}
        onClose={() => {
          setShowCommandView(false);
          setViewingCommand(null);
        }}
      />
    </div>
  );
};

// Client Modal Component
const ClientModal: React.FC<{
  isOpen: boolean;
  client: SSHClient | null;
  onClose: () => void;
  onSave: (client: Omit<SSHClient, 'id'>) => void;
}> = ({ isOpen, client, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    snippet: ''
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        host: client.host,
        port: client.port,
        username: client.username,
        password: client.password || '',
        snippet: client.snippet || ''
      });
    } else {
      setFormData({
        name: '',
        host: '',
        port: 22,
        username: '',
        password: '',
        snippet: ''
      });
    }
  }, [client, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{client ? 'Sửa SSH Client' : 'Thêm SSH Client'}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Tên</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Production Server"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Host</label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="root"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Snippet (thực thi sau khi kết nối)</label>
            <textarea
              value={formData.snippet}
              onChange={(e) => setFormData({ ...formData, snippet: e.target.value })}
              placeholder="cd /opt/flink"
              rows={3}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(formData)}
            disabled={!formData.name || !formData.host || !formData.username}
          >
            Lưu
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Group Modal Component
const GroupModal: React.FC<{
  isOpen: boolean;
  group: CommandGroup | null;
  onClose: () => void;
  onSave: (name: string) => void;
}> = ({ isOpen, group, onClose, onSave }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(group?.name || '');
  }, [group, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="modal modal-small"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{group ? 'Sửa nhóm' : 'Thêm nhóm'}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Tên nhóm</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cache"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(name)}
            disabled={!name}
          >
            Lưu
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Command Modal Component
const CommandModal: React.FC<{
  isOpen: boolean;
  command: Command | null;
  onClose: () => void;
  onSave: (command: Omit<Command, 'id'>) => void;
}> = ({ isOpen, command, onClose, onSave }) => {
  const [formData, setFormData] = useState({ name: '', content: '' });

  useEffect(() => {
    if (command) {
      setFormData({ name: command.name, content: command.content });
    } else {
      setFormData({ name: '', content: '' });
    }
  }, [command, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{command ? 'Sửa command' : 'Thêm command'}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Tên command</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Restart Cache Job"
            />
          </div>
          <div className="form-group">
            <label>Nội dung command</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="./bin/flink run -d ./jobs/cache-job.jar"
              rows={6}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(formData)}
            disabled={!formData.name || !formData.content}
          >
            Lưu
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Command View Modal
const CommandViewModal: React.FC<{
  isOpen: boolean;
  command: Command | null;
  onClose: () => void;
}> = ({ isOpen, command, onClose }) => {
  if (!isOpen || !command) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{command.name}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="command-preview">
            <pre>{command.content}</pre>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Đóng</button>
        </div>
      </motion.div>
    </div>
  );
};

export default App;