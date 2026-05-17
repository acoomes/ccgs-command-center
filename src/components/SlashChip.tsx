import type { MouseEvent } from 'react';

interface SlashChipProps {
  cmd: string;
  onRun: (cmd: string) => void;
  suggested?: boolean;
  selected?: boolean;
}

export function SlashChip({ cmd, onRun, suggested, selected }: SlashChipProps) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onRun(cmd);
  };
  const cls = ['hf-slash', suggested && 'suggested', selected && 'selected']
    .filter(Boolean).join(' ');
  return <span className={cls} onClick={handleClick}>{cmd}</span>;
}
