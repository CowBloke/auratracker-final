import { useEffect, useState, type RefObject } from 'react';
import { Bold, Palette, Underline } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type EditableInput = HTMLInputElement | HTMLTextAreaElement;

type FormatOption = {
  code: string;
  label: string;
  className?: string;
  icon?: 'bold' | 'underline' | 'palette';
};

const FORMAT_OPTIONS: FormatOption[] = [
  { code: 'g', label: 'Vert', className: 'text-emerald-500', icon: 'palette' },
  { code: 'r', label: 'Rouge', className: 'text-red-500', icon: 'palette' },
  { code: 'bl', label: 'Bleu', className: 'text-sky-500', icon: 'palette' },
  { code: 'y', label: 'Jaune', className: 'text-yellow-500', icon: 'palette' },
  { code: 'p', label: 'Violet', className: 'text-purple-500', icon: 'palette' },
  { code: 'pink', label: 'Rose', className: 'text-pink-500', icon: 'palette' },
  { code: 'o', label: 'Orange', className: 'text-orange-500', icon: 'palette' },
  { code: 'c', label: 'Cyan', className: 'text-cyan-500', icon: 'palette' },
  { code: 'rainbow', label: 'Multicouleur', className: 'animated-message-rainbow font-semibold', icon: 'palette' },
  { code: 'bold', label: 'Gras', className: 'font-bold', icon: 'bold' },
  { code: 'u', label: 'Souligné', className: 'underline underline-offset-2', icon: 'underline' },
];

function FormatIcon({ option }: { option: FormatOption }) {
  if (option.icon === 'bold') return <Bold className="h-3.5 w-3.5" />;
  if (option.icon === 'underline') return <Underline className="h-3.5 w-3.5" />;
  return <Palette className="h-3.5 w-3.5" />;
}

export function MessageFormatToolbar({
  inputRef,
  value,
  onChange,
}: {
  inputRef: RefObject<EditableInput>;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const updateRange = () => {
      const input = inputRef.current;
      if (!input || document.activeElement !== input) return;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      setRange(end > start ? { start, end } : null);
    };

    document.addEventListener('selectionchange', updateRange);
    document.addEventListener('keyup', updateRange);
    document.addEventListener('mouseup', updateRange);
    return () => {
      document.removeEventListener('selectionchange', updateRange);
      document.removeEventListener('keyup', updateRange);
      document.removeEventListener('mouseup', updateRange);
    };
  }, [inputRef]);

  if (!range) return null;

  const applyFormat = (code: string) => {
    const input = inputRef.current;
    if (!input || !range) return;

    const selectedText = value.slice(range.start, range.end);
    if (!selectedText) return;

    const wrappedText = `#${code}[${selectedText}]#${code}`;
    const nextValue = `${value.slice(0, range.start)}${wrappedText}${value.slice(range.end)}`;
    const nextStart = range.start;
    const nextEnd = range.start + wrappedText.length;

    onChange(nextValue);
    setRange({ start: nextStart, end: nextEnd });

    window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextStart, nextEnd);
    });
  };

  return (
    <div className="mt-2 flex items-center justify-start">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-[11px]">
            <Palette className="h-3.5 w-3.5" />
            Format
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {FORMAT_OPTIONS.slice(0, 9).map((option) => (
            <DropdownMenuItem key={option.code} onClick={() => applyFormat(option.code)} className="gap-2">
              <FormatIcon option={option} />
              <span className={option.className}>{option.label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {FORMAT_OPTIONS.slice(9).map((option) => (
            <DropdownMenuItem key={option.code} onClick={() => applyFormat(option.code)} className="gap-2">
              <FormatIcon option={option} />
              <span className={option.className}>{option.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
