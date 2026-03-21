import { Gift } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { giftsApi } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import GiftDialog from './GiftDialog';
import { Button } from '@/components/ui/button';

export default function GiftBubble() {
  const [count, setCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { socket } = useSocketBase();

  const fetchCount = useCallback(async () => {
    try {
      const res = await giftsApi.getInboxCount();
      setCount(res.data.count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!socket) return;
    const handleGiftReceived = () => {
      fetchCount();
    };
    socket.on('gift:received', handleGiftReceived);
    return () => {
      socket.off('gift:received', handleGiftReceived);
    };
  }, [socket, fetchCount]);

  return (
    <>
      <Button
        type="button"
        onClick={() => setDialogOpen(true)}
        title="Cadeaux"
        variant="outline"
        size="icon"
        className={`relative h-11 w-11 rounded-full shadow-sm ${count > 0 ? 'animate-gift-wiggle' : ''}`}
      >
        <Gift className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-medium rounded-full bg-red-500 text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>
      <GiftDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onGiftOpened={fetchCount}
      />
    </>
  );
}
