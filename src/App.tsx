import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Settings, Download, Cpu, Activity, Info } from 'lucide-react';
import { SpiceEditor } from './components/SpiceEditor';
import { Console } from './components/Console';
import { PlotViewer } from './components/PlotViewer';
import { FileExplorer } from './components/FileExplorer';
import { SpiceFile, SimulationResult } from './types';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_NETLIST = `* Simple RC Circuit
V1 1 0 SIN(0 5 1k)
R1 1 2 1k
C1 2 0 1u
.tran 0.1m 5m
.control
set filetype=ascii
run
plot v(1) v(2)
.endc
.end`;

export default function App() {
  const [files, setFiles] = useState<SpiceFile[]>([
    { id: '1', name: 'rc_circuit.cir', content: DEFAULT_NETLIST }
  ]);
  const [activeFileId, setActiveFileId] = useState<string | null>('1');
  const [logs, setLogs] = useState<string>("");
  const [plotData, setPlotData] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState("http://localhost:5000");
  const [showSettings, setShowSettings] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'online' | 'offline' | 'mock'>('offline');

  const activeFile = files.find(f => f.id === activeFileId);

  // Check bridge status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // First check if real bridge is online
        const res = await fetch(`${bridgeUrl}/status`).catch(() => null);
        if (res && res.ok) {
          setBridgeStatus('online');
          return;
        }

        // Fallback to mock API for preview
        const mockRes = await fetch('/api/mock/status');
        if (mockRes.ok) {
          setBridgeStatus('mock');
        } else {
          setBridgeStatus('offline');
        }
      } catch (e) {
        setBridgeStatus('offline');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [bridgeUrl]);

  const handleRunSimulation = async () => {
    if (!activeFile) return;
    setIsSimulating(true);
    setLogs("Starting simulation...\n");
    
    try {
      const endpoint = bridgeStatus === 'online' 
        ? `${bridgeUrl}/simulate` 
        : '/api/mock/simulate';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ netlist: activeFile.content })
      });

      const result: SimulationResult = await response.json();
      
      // Always show stdout and stderr if they exist
      if (result.stdout) {
        setLogs(prev => prev + result.stdout + "\n");
      }
      if (result.stderr) {
        setLogs(prev => prev + "STDERR:\n" + result.stderr + "\n");
      }

      if (result.success) {
        if (result.plotData && result.plotData.length > 0) {
          setPlotData(result.plotData);
        } else {
          setLogs(prev => prev + "Warning: No plot data found in simulation output.\n");
        }
      } else {
        setLogs(prev => prev + "Simulation process exited with an error.\n");
      }
    } catch (error) {
      setLogs(prev => prev + "Error connecting to bridge: " + (error as Error).message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleFileChange = (content: string | undefined) => {
    if (activeFileId && content !== undefined) {
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content } : f));
    }
  };

  const handleNewFile = () => {
    const newFile: SpiceFile = {
      id: Date.now().toString(),
      name: `new_file_${files.length + 1}.cir`,
      content: "* New SPICE Circuit\n"
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (activeFileId === id) setActiveFileId(files[0]?.id || null);
  };

  const downloadBridge = () => {
    // In a real app, this would trigger a download of bridge.py
    alert("You can find the bridge.py code in the project files. Run it locally with 'python bridge.py' to connect your local ngspice.");
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0b] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#151619]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Cpu size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">SpiceIDE</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                bridgeStatus === 'online' ? 'bg-green-500' : 
                bridgeStatus === 'mock' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                Bridge: {bridgeStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleRunSimulation}
            disabled={isSimulating || !activeFile}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 rounded-md text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            {isSimulating ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            {isSimulating ? "STOP" : "RUN SIMULATION"}
          </button>
          
          <div className="w-px h-6 bg-white/10 mx-2" />
          
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-md transition-colors ${showSettings ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5'}`}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <FileExplorer 
            files={files} 
            activeFileId={activeFileId} 
            onSelect={setActiveFileId}
            onNew={handleNewFile}
            onDelete={handleDeleteFile}
          />
        </aside>

        {/* Editor and Results Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top: Editor and Plot */}
          <div className="flex-1 flex overflow-hidden p-4 gap-4">
            <div className="flex-[3] min-w-0">
              <SpiceEditor 
                value={activeFile?.content || ""} 
                onChange={handleFileChange} 
              />
            </div>
            <div className="flex-[2] min-w-0">
              <PlotViewer data={plotData} />
            </div>
          </div>

          {/* Bottom: Console */}
          <div className="h-64 p-4 pt-0">
            <Console logs={logs} />
          </div>
        </div>
      </main>

      {/* Settings Modal Overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1c1d21] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#25262b]">
                <div className="flex items-center gap-3">
                  <Settings size={20} className="text-blue-400" />
                  <h2 className="font-bold">Bridge Settings</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white">
                  <Square size={14} className="rotate-45" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Local Bridge URL</label>
                  <input 
                    type="text" 
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="http://localhost:5000"
                  />
                  <p className="text-[10px] text-white/30 italic">
                    The URL of the Python script running on your local machine.
                  </p>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
                  <Info size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-xs text-blue-100/80 leading-relaxed">
                      To connect to your local <span className="font-mono text-blue-300">ngspice</span>, you need to run the Python bridge script provided in this project.
                    </p>
                    <button 
                      onClick={downloadBridge}
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-xs font-bold transition-colors"
                    >
                      <Download size={14} />
                      How to setup local bridge
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl text-sm font-bold transition-all"
                  >
                    Close Settings
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar */}
      <footer className="h-6 border-t border-white/10 bg-[#0c0c0d] flex items-center justify-between px-4 text-[10px] text-white/30 font-medium">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Activity size={10} />
            <span>Ready</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>SPICE 3f5 / ngspice</span>
          <div className="w-px h-3 bg-white/10" />
          <span>Line 1, Col 1</span>
        </div>
      </footer>
    </div>
  );
}
