import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, Check, X, Library, Info, Search, FileCode, Upload } from 'lucide-react';
import { SpiceModel } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ModelLibraryProps {
  models: SpiceModel[];
  activeModelId: string | null;
  onAdd: (model: SpiceModel) => void;
  onUpdate: (model: SpiceModel) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onSelect: (id: string | null) => void;
}

export const ModelLibrary: React.FC<ModelLibraryProps> = ({ 
  models, activeModelId, onAdd, onUpdate, onDelete, onToggle, onSelect 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleAdd = () => {
    if (!newName || !newContent) return;
    onAdd({
      id: Date.now().toString(),
      name: newName,
      content: newContent,
      enabled: true
    });
    setNewName('');
    setNewContent('');
    setIsAdding(false);
  };

  const startEdit = (model: SpiceModel) => {
    setEditingId(model.id);
    setNewName(model.name);
    setNewContent(model.content);
  };

  const handleUpdate = () => {
    if (!editingId) return;
    onUpdate({
      id: editingId,
      name: newName,
      content: newContent,
      enabled: models.find(m => m.id === editingId)?.enabled || false
    });
    setEditingId(null);
    setNewName('');
    setNewContent('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    droppedFiles.forEach(file => {
      if (file.name.endsWith('.cir') || file.name.endsWith('.lib') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          onAdd({
            id: Date.now().toString() + Math.random(),
            name: file.name,
            content: content,
            enabled: true
          });
        };
        reader.readAsText(file);
      }
    });
  }, [onAdd]);

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className={`flex flex-col h-full bg-[#151619] border-r border-white/10 transition-colors ${isDragging ? 'bg-blue-500/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-4 border-b border-white/10 bg-[#1c1d21] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library size={16} className="text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/70">Model Library</h2>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="p-1 hover:bg-white/10 rounded-md text-blue-400 transition-colors"
            title="Add Model"
          >
            <Plus size={18} />
          </button>
        </div>
        
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input 
            placeholder="Search models..."
            className="w-full bg-black/40 border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-[10px] focus:outline-none focus:border-blue-500/30 transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar relative">
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-500 m-2 rounded-xl flex flex-col items-center justify-center text-blue-400 pointer-events-none">
            <Upload size={32} className="mb-2 animate-bounce" />
            <p className="text-xs font-bold uppercase tracking-widest">Drop .cir files here</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-3"
            >
              <input 
                autoFocus
                placeholder="Model Name (e.g. 1N4148)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500/50"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <textarea 
                placeholder=".model D1N4148 D(Is=2.682n N=1.836 ...)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-mono h-24 focus:outline-none focus:border-blue-500/50 resize-none"
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsAdding(false)} className="p-1.5 hover:bg-white/10 rounded-md text-white/40"><X size={14} /></button>
                <button onClick={handleAdd} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-white"><Check size={14} /></button>
              </div>
            </motion.div>
          )}

          {filteredModels.map(model => (
            <motion.div 
              layout
              key={model.id}
              onClick={() => onSelect(model.id)}
              className={`group p-3 rounded-xl border cursor-pointer transition-all ${
                activeModelId === model.id 
                  ? 'bg-blue-500/10 border-blue-500/50' 
                  : model.enabled 
                    ? 'bg-white/5 border-white/10 hover:border-white/20' 
                    : 'bg-black/20 border-white/5 opacity-60 hover:opacity-80'
              }`}
            >
              {editingId === model.id ? (
                <div className="space-y-3" onClick={e => e.stopPropagation()}>
                  <input 
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500/50"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                  <textarea 
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-mono h-24 focus:outline-none focus:border-blue-500/50 resize-none"
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-white/10 rounded-md text-white/40"><X size={14} /></button>
                    <button onClick={handleUpdate} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-white"><Check size={14} /></button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div onClick={e => e.stopPropagation()} className="flex items-center">
                        <input 
                          type="checkbox" 
                          checked={model.enabled} 
                          onChange={(e) => {
                            onToggle(model.id);
                          }}
                          className="w-3 h-3 rounded border-white/20 bg-transparent text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </div>
                      <span className={`text-xs font-bold ${activeModelId === model.id ? 'text-blue-400' : 'text-white/80'}`}>
                        {model.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(model.id);
                        }} 
                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-blue-400"
                        title="View in Editor"
                      >
                        <FileCode size={12} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(model);
                        }} 
                        className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(model.id);
                        }} 
                        className="p-1 hover:bg-red-500/20 rounded text-white/40 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <pre className="text-[9px] text-white/30 font-mono overflow-hidden text-ellipsis whitespace-nowrap bg-black/20 p-1.5 rounded-md">
                    {model.content}
                  </pre>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredModels.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4 opacity-30">
            <Library size={32} className="mb-2" />
            <p className="text-[10px] font-medium uppercase tracking-widest">
              {searchQuery ? 'No matches found' : 'Library is empty'}
            </p>
            <p className="text-[9px] mt-1 normal-case italic">
              {searchQuery ? 'Try a different search term.' : 'Add models or drop .cir files here.'}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 bg-[#1c1d21] border-t border-white/10">
        <div className="flex gap-2 text-[10px] text-blue-400/60 leading-tight">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <p>Drop .cir files to import models. Click a model to view it in the editor.</p>
        </div>
      </div>
    </div>
  );
};
