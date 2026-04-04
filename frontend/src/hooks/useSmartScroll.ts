import { useEffect, useRef, useState } from 'react';

const SCROLL_THRESHOLD = 100; // pixels from bottom to consider as "at bottom"

interface UseSmartScrollProps {
  dependency: any[];
  scrollAreaSelector?: string; // CSS selector for the scrollable container
}

export function useSmartScroll({ dependency, scrollAreaSelector }: UseSmartScrollProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLElement | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const wasAtBottomRef = useRef(true);

  // Initialize scroll area ref
  useEffect(() => {
    if (scrollAreaSelector) {
      scrollAreaRef.current = document.querySelector(scrollAreaSelector) as HTMLElement;
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
    const scrollArea = scrollAreaRef.current;
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
  }, []);

  // Smart scroll effect - only scroll if was at bottom
  useEffect(() => {
    if (wasAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasNewMessage(false);
    } else {
      // Show new message indicator if user scrolled up
      setHasNewMessage(true);
    }
  }, dependency);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessage(false);
  };

  return {
    messagesEndRef,
    hasNewMessage,
    isAtBottom,
    scrollToBottom,
    setScrollAreaRef: (ref: HTMLElement) => {
      scrollAreaRef.current = ref;
    },
  };
}
