import { useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_THRESHOLD = 100; // pixels from bottom to consider as "at bottom"

interface UseSmartScrollProps {
  dependency: any[];
  scrollAreaSelector?: string; // CSS selector for the scrollable container
}

export function useSmartScroll({ dependency, scrollAreaSelector }: UseSmartScrollProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLElement | null>(null);
  const [scrollAreaElement, setScrollAreaElement] = useState<HTMLElement | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const wasAtBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const scrollArea = scrollAreaRef.current;

    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
      setHasNewMessage(false);
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    setHasNewMessage(false);
  }, []);

  // Initialize scroll area ref
  useEffect(() => {
    if (scrollAreaSelector) {
      const element = document.querySelector(scrollAreaSelector) as HTMLElement | null;
      scrollAreaRef.current = element;
      setScrollAreaElement(element);
    }
  }, [scrollAreaSelector]);

  // Check if user was at bottom before new message arrives
  const checkIfAtBottom = () => {
    if (scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      return distanceFromBottom < SCROLL_THRESHOLD;
    }
    return true; // Default to true if we can't check
  };

  // Handle scroll event to track if user has scrolled up
  useEffect(() => {
    const scrollArea = scrollAreaElement ?? scrollAreaRef.current;
    if (!scrollArea) return;

    const handleScroll = () => {
      const isAtBottom = checkIfAtBottom();
      wasAtBottomRef.current = isAtBottom;
      setIsAtBottom(isAtBottom);
      
      // Hide new message indicator when user scrolls back to bottom
      if (isAtBottom) {
        setHasNewMessage(false);
      }
    };

    handleScroll();
    scrollArea.addEventListener('scroll', handleScroll);
    return () => scrollArea.removeEventListener('scroll', handleScroll);
  }, [scrollAreaElement]);

  // Smart scroll effect - only scroll if was at bottom
  useEffect(() => {
    if (wasAtBottomRef.current) {
      scrollToBottom();
    } else {
      // Show new message indicator if user scrolled up
      setHasNewMessage(true);
    }
  }, dependency);

  return {
    messagesEndRef,
    hasNewMessage,
    isAtBottom,
    scrollToBottom,
    setScrollAreaRef: (ref: HTMLElement) => {
      scrollAreaRef.current = ref;
      setScrollAreaElement(ref);
    },
  };
}
