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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

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
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Party
          </h1>
          <p className="text-muted-foreground mt-2">
            Team up with friends to play together
          </p>
        </div>

        {!currentParty && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Create Party
          </Button>
        )}
      </div>

      {/* Party Invites */}
      {partyInvites.length > 0 && (
        <Card className="bg-primary/10 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Party Invites
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {partyInvites.map((invite) => (
              <div
                key={invite.partyId}
                className="flex items-center justify-between p-3 rounded-lg bg-muted"
              >
                <div>
                  <p className="font-medium">{invite.partyName || 'Unnamed Party'}</p>
                  <p className="text-sm text-muted-foreground">
                    Invited by {invite.inviterUsername}
                  </p>
                </div>
                <Button onClick={() => joinParty(invite.partyId)} size="sm">
                  Join
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Current Party */}
      {currentParty ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {currentParty.name || 'Your Party'}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
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
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isLeader && (
                  <Button
                    onClick={() => setShowInviteModal(true)}
                    variant="secondary"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invite
                  </Button>
                )}
                <Button
                  onClick={leaveParty}
                  variant="destructive"
                >
                  <LogOut className="w-4 h-4" />
                  Leave
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>

            {/* Members List */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Members
              </h3>
              {partyMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {member.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {member.username}
                        {member.isLeader && (
                          <Crown className="w-4 h-4 text-primary" />
                        )}
                        {member.userId === user?.id && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.isLeader ? 'Leader' : 'Member'}
                      </p>
                    </div>
                  </div>
                  {isLeader && member.userId !== user?.id && (
                    <Button
                      onClick={() => kickFromParty(member.userId)}
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title="Kick"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Public Parties List */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Public Parties</CardTitle>
              <Button
                onClick={fetchPublicParties}
                variant="secondary"
                size="sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {publicParties.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-bold text-muted-foreground mb-2">No Public Parties</h3>
                <p className="text-muted-foreground">Create one to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {publicParties.map((party) => (
                  <div
                    key={party.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{party.name || 'Unnamed Party'}</p>
                      <p className="text-sm text-muted-foreground">
                        {party.memberCount}/{party.maxSize} members
                      </p>
                    </div>
                    <Button
                      onClick={() => joinParty(party.id)}
                      disabled={party.memberCount >= party.maxSize}
                      size="sm"
                    >
                      {party.memberCount >= party.maxSize ? 'Full' : 'Join'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Party Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Party</DialogTitle>
            <DialogDescription>
              Create a new party to play with friends
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partyName">Party Name (optional)</Label>
              <Input
                id="partyName"
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="My Awesome Party"
              />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked === true)}
              />
              <Label htmlFor="isPublic" className="cursor-pointer">
                Make party public (anyone can join)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateParty}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to Party</DialogTitle>
            <DialogDescription>
              Select a user to invite to your party
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableUsersToInvite.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No users available to invite
              </p>
            ) : (
              availableUsersToInvite.map((u) => (
                <Button
                  key={u.id}
                  onClick={() => handleInvite(u.id)}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <Avatar>
                    <AvatarFallback>
                      {u.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium ml-3">{u.username}</span>
                </Button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowInviteModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
