/**
 * AddressBar — 브라우저식 상단바: 뒤로/앞으로/새로고침/주소창/외부열기/편집/삭제.
 */

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppUrlEntry } from "@desktop/types/electron";

interface Props {
  entry: AppUrlEntry;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onOpenExternal: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onUrlChange: (url: string) => void;
}

export function AddressBar({
  entry,
  onBack,
  onForward,
  onReload,
  onOpenExternal,
  onEdit,
  onRemove,
  onUrlChange,
}: Props) {
  const [addressInput, setAddressInput] = useState(entry.url);

  useEffect(() => setAddressInput(entry.url), [entry.url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = addressInput.startsWith("http")
      ? addressInput
      : `https://${addressInput}`;
    onUrlChange(next);
  };

  return (
    <header className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2 border-b border-border/40">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} title="뒤로">
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onForward} title="앞으로">
        <ArrowRight className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReload} title="새로고침">
        <RefreshCw className="w-4 h-4" />
      </Button>
      <form onSubmit={handleSubmit} className="flex-1">
        <Input
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          className="h-8 text-xs font-mono bg-muted/30"
        />
      </form>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onOpenExternal}
        title="시스템 브라우저에서 열기"
      >
        <ExternalLink className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="편집">
        <Pencil className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:text-destructive"
        onClick={onRemove}
        title="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </header>
  );
}
