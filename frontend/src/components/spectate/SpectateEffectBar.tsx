import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Button } from '@/components/ui/button';

export interface SpectateFloatingMessage {
  id: number;
  text: string;
  username: string;
  y: number;         // % from top, 5–80
  direction: 'ltr' | 'rtl';
  duration: number;  // ms
}

interface Props {
  messages: SpectateFloatingMessage[];
  onSend?: (text: string) => void;
  onConfetti?: () => void;
  showInput?: boolean;
}

const KEYFRAMES = `
@keyframes spectate-ltr {
  from { left: -420px; }
  to   { left: 110%;  }
}
@keyframes spectate-rtl {
  from { right: -420px; }
  to   { right: 110%;  }
}
`;

let styleInjected = false;
function ensureStyles() {
  if (styleInjected) return;
  const style = document.createElement('style');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  styleInjected = true;
}

export function SpectateEffectBar({ messages, onSend, onConfetti, showInput = true }: Props) {
  const [text, setText] = useState('');
  const lastSentAtRef = useRef(0);

  useEffect(() => { ensureStyles(); }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < 1000) return; // 1 s client-side cooldown
    lastSentAtRef.current = now;
    onSend?.(trimmed);
    setText('');
  }, [text, onSend]);

  return (
    <>
      {/* Floating messages — pointer-events-none so they don't block game */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="absolute whitespace-nowrap select-none text-sm font-semibold"
            style={{
              top: `${msg.y}%`,
              ...(msg.direction === 'ltr' ? { left: '-420px' } : { right: '-420px' }),
              animationName: `spectate-${msg.direction}`,
              animationDuration: `${msg.duration}ms`,
              animationTimingFunction: 'linear',
              animationFillMode: 'forwards',
              textShadow: '0 1px 4px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.6)',
              color: '#fff',
            }}
          >
            <span className="opacity-60 text-xs mr-1">{msg.username}:</span>
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input bar — only for spectators */}
      {showInput && (
        <div className="absolute bottom-2 left-2 right-2 z-20">
          <form onSubmit={handleSubmit}>
            <InputGroup className="bg-background/75">
              <InputGroupInput
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Envoyer un message… 🎉"
                maxLength={80}
              />
              <InputGroupAddon align="inline-end">
                {onConfetti && (
                  <InputGroupButton type="button" size="icon-xs" onClick={onConfetti} title="Lancer des confettis" aria-label="Lancer des confettis">
                    <Sparkles />
                  </InputGroupButton>
                )}
                <InputGroupButton type="submit" size="icon-xs" aria-label="Envoyer">
                  <Send />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      )}
    </>
  );
}
