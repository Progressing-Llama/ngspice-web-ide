import React from 'react';
import { FileText, Plus, Edit2, Trash2, Download } from 'lucide-react';
import { SpiceFile } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileExplorerProps {
  files: SpiceFile[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDownload: (file: SpiceFile) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files, 
  activeFileId, 
  onSelect, 
  onNew,
  onDelete,
  onRename,
  onDownload
}) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");

  const startEditing = (file: SpiceFile) => {
    setEditingId(file.id);
    setEditName(file.name);
  };

  const submitRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#151619] border-r border-white/10">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-white/40">Files</span>
        <button 
          onClick={onNew}
          className="p-1.5 hover:bg-white/10 rounded-md text-white/60 transition-colors"
          title="New File"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.map(file => (
          <div 
            key={file.id}
            className={cn(
              "group flex items-center justify-between p-2 rounded-md cursor-pointer transition-all",
              activeFileId === file.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5"
            )}
            onClick={() => onSelect(file.id)}
          >
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <FileText size={14} className={activeFileId === file.id ? "text-blue-400" : "text-white/30"} />
              {editingId === file.id ? (
                <input
                  autoFocus
                  className="bg-black/40 border border-blue-500/50 rounded px-1 text-sm w-full outline-none"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm truncate">{file.name}</span>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(file);
                }}
                className="p-1 hover:text-blue-400 transition-all"
                title="Download"
              >
                <Download size={12} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(file);
                }}
                className="p-1 hover:text-yellow-400 transition-all"
                title="Rename"
              >
                <Edit2 size={12} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.id);
                }}
                className="p-1 hover:text-red-400 transition-all"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
