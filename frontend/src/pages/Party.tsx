import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { usersApi } from '../services/api';
import {
  Users,
  Plus,
  LogOut,
  Crown,
  UserPlus,
  X,
  Globe,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
}

export default function Party() {
  const { user } = useAuth();
  const {
    currentParty,
    partyMembers,
    partyInvites,
    publicParties,
    createParty,
    joinParty,
    leaveParty,
    inviteToParty,
    kickFromParty,
    fetchPublicParties,
  } = useSocket();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchPublicParties();
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setAllUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleCreateParty = () => {
    createParty(partyName || undefined, isPublic);
    setShowCreateModal(false);
    setPartyName('');
    setIsPublic(false);
  };

  const handleInvite = (userId: string) => {
    inviteToParty(userId);
    setShowInviteModal(false);
  };

  const isLeader = partyMembers.find((m) => m.userId === user?.id)?.isLeader;
  const availableUsersToInvite = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      !partyMembers.find((m) => m.userId === u.id)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <Users className="w-8 h-8 text-accent-cyan" />
            Party
          </h1>
          <p className="text-gray-400 mt-2">
            Team up with friends to play together
          </p>
        </div>

        {!currentParty && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Party
          </button>
        )}
      </div>

      {/* Party Invites */}
      {partyInvites.length > 0 && (
        <div className="card p-4 bg-primary/10 border-primary/30">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Party Invites
          </h3>
          <div className="space-y-2">
            {partyInvites.map((invite) => (
              <div
                key={invite.partyId}
                className="flex items-center justify-between p-3 rounded-lg bg-surface"
              >
                <div>
                  <p className="font-medium">{invite.partyName || 'Unnamed Party'}</p>
                  <p className="text-sm text-gray-400">
                    Invited by {invite.inviterUsername}
                  </p>
                </div>
                <button
                  onClick={() => joinParty(invite.partyId)}
                  className="btn-primary text-sm"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Party */}
      {currentParty ? (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">
                {currentParty.name || 'Your Party'}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                {currentParty.isPublic ? (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Public</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Private</span>
                  </>
                )}
                <span>•</span>
                <span>{partyMembers.length}/{currentParty.maxSize} members</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLeader && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Invite
                </button>
              )}
              <button
                onClick={leaveParty}
                className="btn-danger flex items-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Leave
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Members
            </h3>
            {partyMembers.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                    <span className="font-bold text-primary">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {member.username}
                      {member.isLeader && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                      {member.userId === user?.id && (
                        <span className="text-xs text-primary">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.isLeader ? 'Leader' : 'Member'}
                    </p>
                  </div>
                </div>
                {isLeader && member.userId !== user?.id && (
                  <button
                    onClick={() => kickFromParty(member.userId)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-400"
                    title="Kick"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Public Parties List */
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Public Parties</h2>
            <button
              onClick={fetchPublicParties}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {publicParties.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-400 mb-2">No Public Parties</h3>
              <p className="text-gray-500">Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {publicParties.map((party) => (
                <div
                  key={party.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-surface-hover transition-colors"
                >
                  <div>
                    <p className="font-medium">{party.name || 'Unnamed Party'}</p>
                    <p className="text-sm text-gray-400">
                      {party.memberCount}/{party.maxSize} members
                    </p>
                  </div>
                  <button
                    onClick={() => joinParty(party.id)}
                    disabled={party.memberCount >= party.maxSize}
                    className="btn-primary text-sm"
                  >
                    {party.memberCount >= party.maxSize ? 'Full' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Party Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md animate-slide-up">
            <h2 className="text-xl font-bold mb-4">Create Party</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Party Name (optional)
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="input"
                  placeholder="My Awesome Party"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-primary focus:ring-primary"
                />
                <label htmlFor="isPublic" className="text-sm text-gray-300">
                  Make party public (anyone can join)
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={handleCreateParty} className="btn-primary flex-1">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md animate-slide-up">
            <h2 className="text-xl font-bold mb-4">Invite to Party</h2>
            <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-thin">
              {availableUsersToInvite.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  No users available to invite
                </p>
              ) : (
                availableUsersToInvite.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleInvite(u.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-surface-hover transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                      <span className="font-bold text-primary">
                        {u.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium">{u.username}</span>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowInviteModal(false)}
              className="btn-secondary w-full mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
