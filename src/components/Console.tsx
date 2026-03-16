import React from 'react';
import { Terminal } from 'lucide-react';

interface ConsoleProps {
  logs: string;
  error?: string;
}

export const Console: React.FC<ConsoleProps> = ({ logs, error }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, error]);

  return (
    <div 
      ref={scrollRef}
      className="h-full w-full bg-[#0c0c0c] text-green-400 font-mono text-sm p-4 overflow-auto border border-white/10 rounded-lg shadow-inner scroll-smooth"
    >
      <div className="flex items-center gap-2 mb-2 text-white/50 border-b border-white/10 pb-2 sticky top-0 bg-[#0c0c0c] z-10">
        <Terminal size={14} />
        <span className="text-xs uppercase tracking-wider font-sans font-semibold">Output Console</span>
      </div>
      <pre className="whitespace-pre-wrap break-words leading-relaxed">
        {logs || "Ready for simulation..."}
        {error && <span className="text-red-500 block mt-2">{error}</span>}
      </pre>
    </div>
  );
};
