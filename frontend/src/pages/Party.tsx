import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { usersApi } from '../services/api';
import { Plus, LogOut, UserPlus, X, RefreshCw, Bomb } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  username: string;
  usernameColor?: string | null;
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
    syncParty,
  } = useSocket();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    syncParty(); // Sync party state to resolve any ghost states
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
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Multijoueur
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Party
            </h1>
          </div>
          {!currentParty && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <Plus className="h-4 w-4" />
              Créer
            </button>
          )}
        </div>
      </header>

      {/* Invites */}
      {partyInvites.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Invitations
          </h2>
          <div className="space-y-0">
            {partyInvites.map((invite) => (
              <div
                key={invite.partyId}
                className="flex items-center justify-between py-4 border-b border-border/30"
              >
                <div>
                  <p className="font-medium">{invite.partyName || 'Party sans nom'}</p>
                  <p className="text-sm text-muted-foreground">
                    de {invite.inviterUsername}
                  </p>
                </div>
                <button
                  onClick={() => joinParty(invite.partyId)}
                  className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  Rejoindre
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Current Party or Public Parties */}
      {currentParty ? (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-light">
                {currentParty.name || 'Ta party'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentParty.isPublic ? 'Publique' : 'Privée'} · {partyMembers.length}/{currentParty.maxSize}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isLeader && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  Inviter
                </button>
              )}
              <button
                onClick={leaveParty}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Quitter
              </button>
            </div>
          </div>

          {/* Party Games */}
          <div className="flex flex-wrap gap-3 py-4 border-b border-border/30">
            <Link
              to="/games/bomb-party"
              className="flex items-center gap-2 px-4 py-2 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <Bomb className="h-4 w-4" />
              Bomb Party
            </Link>
          </div>

          {/* Members */}
          <div className="space-y-0">
            {partyMembers.map((member) => (
              <div
                key={member.userId}
                className={cn(
                  "flex items-center justify-between py-4 border-b border-border/30 last:border-0",
                  member.userId === user?.id && "bg-muted/30 -mx-4 px-4"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    <span style={member.usernameColor ? { color: member.usernameColor } : undefined}>
                      {member.username}
                    </span>
                    {member.isLeader && (
                      <span className="ml-2 text-xs text-muted-foreground">leader</span>
                    )}
                    {member.userId === user?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(toi)</span>
                    )}
                  </span>
                </div>
                {isLeader && member.userId !== user?.id && (
                  <button
                    onClick={() => kickFromParty(member.userId)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
              Parties publiques
            </h2>
            <button
              onClick={fetchPublicParties}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {publicParties.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucune party publique
            </p>
          ) : (
            <div className="space-y-0">
              {publicParties.map((party) => (
                <div
                  key={party.id}
                  className="flex items-center justify-between py-4 border-b border-border/30 last:border-0"
                >
                  <div>
                    <p className="font-medium">{party.name || 'Party sans nom'}</p>
                    <p className="text-sm text-muted-foreground">
                      {party.memberCount}/{party.maxSize} membres
                    </p>
                  </div>
                  <button
                    onClick={() => joinParty(party.id)}
                    disabled={party.memberCount >= party.maxSize}
                    className={cn(
                      "px-4 py-2 text-sm border transition-colors",
                      party.memberCount >= party.maxSize
                        ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                        : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                    )}
                  >
                    {party.memberCount >= party.maxSize ? 'Pleine' : 'Rejoindre'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Create Party Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Créer une party</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Nom (optionnel)"
              className="h-12 bg-transparent border-border/50"
            />
            <div className="flex items-center gap-3">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(checked === true)}
              />
              <Label htmlFor="isPublic" className="cursor-pointer text-sm text-muted-foreground">
                Publique
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="border-border/30"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateParty}
              variant="outline"
              className="border-foreground"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal">Inviter</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-0">
            {availableUsersToInvite.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Personne à inviter
              </p>
            ) : (
              availableUsersToInvite.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleInvite(u.id)}
                  className="w-full text-left py-3 border-b border-border/30 last:border-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {u.username}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteModal(false)}
              className="w-full border-border/30"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
