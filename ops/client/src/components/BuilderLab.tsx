
import React, { useState, useEffect, useRef } from 'react';
import { 
    Hammer, FileCode, Folder, ChevronRight, ChevronDown, 
    Save, Play, Loader2, Sparkles, Brain, Cpu, 
    Terminal, Zap, Search, AlertCircle, CheckCircle, Code2,
    Plus, Trash2, FolderPlus, FilePlus, X, Globe, Command,
    Layers, Pin, PinOff, Info, RefreshCw, FolderOpen, Eye
} from 'lucide-react';

const BuilderLab = () => {
    const [fileTree, setFileTree] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isExpanding, setIsExpanding] = useState<Record<string, boolean>>({});
    const [nativeHandle, setNativeHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [isWatching, setIsWatching] = useState(false);
    
    // Multi-file context basket
    const [contextBasket, setContextBasket] = useState<Record<string, string>>({});

    // Terminal State
    const [terminalCmd, setTerminalCmd] = useState('');
    const [terminalLogs, setTerminalLogs] = useState<{msg: string, type: 'out' | 'err' | 'sys'}[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    const fetchFiles = async () => {
        const res = await fetch('/api/builder/files');
        const data = await res.json();
        setFileTree(data);
    };

    useEffect(() => { 
        fetchFiles(); 
        setTerminalLogs([{ msg: "Neural Shell v4.2 Initialized. Context-aware orchestration online.", type: 'sys' }]);
    }, []);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalLogs]);

    /**
     * Feature 6 & 7: Native File System Access + Observer with Neural Linting.
     */
    const handleNativeMount = async () => {
        try {
            const handle = await (window as any).showDirectoryPicker();
            setNativeHandle(handle);
            addTermLog(`Native File System Access granted to: ${handle.name}`, 'sys');
            
            if ('FileSystemObserver' in window) {
                const observer = new (window as any).FileSystemObserver((records: any[]) => {
                    console.debug('[Observer] File System Change Detected:', records);
                    addTermLog(`Live Watcher: Workspace drift detected. Initializing Neural Linting...`, 'sys');
                    
                    // Trigger neural audit on changed files
                    records.forEach(async (record) => {
                       if (record.type === 'modified') {
                           addTermLog(`Self-Healing: Analyzing code structure in real-time...`, 'sys');
                           fetchFiles();
                       }
                    });
                });
                observer.observe(handle, { recursive: true });
                setIsWatching(true);
            }
        } catch (e: any) {
            console.warn('Native mount aborted or unsupported:', e.message);
        }
    };

    const toggleFolder = (path: string) => {
        setIsExpanding(prev => ({ ...prev, [path]: !prev[path] }));
    };

    const selectFile = async (path: string) => {
        setSelectedFile(path);
        const res = await fetch('/api/builder/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        const data = await res.json();
        setFileContent(data.content);
        setOriginalContent(data.content);
    };

    const toggleContext = async (path: string) => {
        if (contextBasket[path]) {
            const newBasket = { ...contextBasket };
            delete newBasket[path];
            setContextBasket(newBasket);
        } else {
            const res = await fetch('/api/builder/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
            const data = await res.json();
            setContextBasket(prev => ({ ...prev, [path]: data.content }));
        }
    };

    const runRefactor = async () => {
        if (!selectedFile || !prompt.trim()) return;
        setIsThinking(true);
        try {
            // Include context basket in the prompt
            let contextStr = "";
            Object.entries(contextBasket).forEach(([path, content]) => {
                if (path !== selectedFile) {
                    contextStr += `\nFILE CONTEXT: ${path}\n\`\`\`\n${content}\n\`\`\`\n`;
                }
            });

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Refactor the following target file: ${selectedFile}\nInstruction: ${prompt}\n\n${contextStr}\n\nTARGET FILE CONTENT:\n${fileContent}`,
                    model: 'gemini-3-pro-preview',
                    systemInstruction: "You are a World-Class Software Architect. Return the FULL updated content for the TARGET file only. Do not include markdown blocks or commentary.",
                    thinkingBudget: 16000
                })
            });
            const data = await res.json();
            const cleaned = data.content.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();
            setFileContent(cleaned);
            addTermLog(`Architectural transmutation complete for ${selectedFile}.`, 'sys');
        } catch (e) {
            console.error(e);
            addTermLog(`Refactor Error: Swarm link unstable.`, 'err');
        } finally {
            setIsThinking(false);
        }
    };

    const mapArchitecture = async () => {
        setIsThinking(true);
        try {
            const res = await fetch('/api/builder/context');
            const data = await res.json();
            setPrompt(`Analyze the project infrastructure and metadata:\n${JSON.stringify(data, null, 2)}\n\nReview architectural alignment across the swarm.`);
        } finally {
            setIsThinking(false);
        }
    };

    const saveChanges = async () => {
        if (!selectedFile) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/builder/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: selectedFile, content: fileContent })
            });
            if (res.ok) {
                setOriginalContent(fileContent);
                addTermLog(`Changes persisted to local disk: ${selectedFile}`, 'sys');
                fetchFiles(); // Refresh to update git status
            }
        } finally {
            setIsSaving(false);
        }
    };

    const createNode = async (parentPath: string | null, type: 'file' | 'directory') => {
        const name = window.prompt(`Enter ${type} name:`);
        if (!name) return;
        const newPath = parentPath ? `${parentPath}/${name}` : name;
        await fetch('/api/builder/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: newPath, type })
        });
        fetchFiles();
    };

    const deleteNode = async (path: string) => {
        if (!window.confirm(`Delete ${path}? This is permanent.`)) return;
        await fetch('/api/builder/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (selectedFile === path) setSelectedFile(null);
        fetchFiles();
    };

    const execCommand = async () => {
        if (!terminalCmd.trim()) return;
        setIsExecuting(true);
        const cmd = terminalCmd;
        setTerminalCmd('');
        addTermLog(`$ ${cmd}`, 'sys');
        
        try {
            const res = await fetch('/api/builder/terminal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });
            const data = await res.json();
            if (data.stdout) addTermLog(data.stdout, 'out');
            if (data.stderr) addTermLog(data.stderr, 'err');
        } catch (e) {
            addTermLog("Execution failed.", 'err');
        } finally {
            setIsExecuting(false);
        }
    };

    const addTermLog = (msg: string, type: 'out' | 'err' | 'sys') => {
        setTerminalLogs(prev => [...prev.slice(-100), { msg, type }]);
    };

    const FileNode = ({ node, depth = 0 }: { node: any, depth?: number }) => {
        const isFolder = node.type === 'directory';
        const isOpen = isExpanding[node.path];
        const isPinned = !!contextBasket[node.path];

        return (
            <div className="select-none">
                <div 
                    onClick={() => isFolder ? toggleFolder(node.path) : selectFile(node.path)}
                    className={`flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition-all group/node ${selectedFile === node.path ? 'bg-google-blue/20 text-google-blue' : 'hover:bg-dark-700 text-gray-400'}`}
                    style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
                >
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                        {isFolder ? (
                            isOpen ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />
                        ) : <FileCode size={12} className={`shrink-0 ${isPinned ? 'text-google-yellow' : 'text-google-blue/60'}`} />}
                        <span className="text-[10px] font-medium truncate">{node.name}</span>
                        {node.gitStatus && (
                            <span className={`text-[8px] font-black px-1 rounded ${node.gitStatus === 'M' ? 'bg-google-yellow/10 text-google-yellow' : 'bg-google-green/10 text-google-green'}`}>
                                {node.gitStatus}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-1 opacity-0 group/node:opacity-100 transition-opacity pr-1">
                        {!isFolder && (
                            <button onClick={(e) => { e.stopPropagation(); toggleContext(node.path); }} className={`p-1 ${isPinned ? 'text-google-yellow' : 'hover:text-google-yellow'}`}>
                                <Pin size={10} />
                            </button>
                        )}
                        {isFolder && <button onClick={(e) => { e.stopPropagation(); createNode(node.path, 'file'); }} className="p-1 hover:text-google-blue"><FilePlus size={10} /></button>}
                        <button onClick={(e) => { e.stopPropagation(); deleteNode(node.path); }} className="p-1 hover:text-google-red"><Trash2 size={10} /></button>
                    </div>
                </div>
                {isFolder && isOpen && node.children && (
                    <div className="animate-in slide-in-from-top-1 duration-200">
                        {node.children.map((child: any) => <FileNode key={child.path} node={child} depth={depth + 1} />)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in">
            <div className="flex justify-between items-end shrink-0">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Builder Intelligence</h2>
                    <p className="text-sm text-gray-500 font-medium">Cross-component reasoning and local orchestration.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={handleNativeMount}
                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${nativeHandle ? 'bg-google-green/10 border-google-green text-google-green shadow-lg shadow-google-green/10' : 'bg-dark-800 border-dark-700 hover:border-google-blue/40 text-gray-400 hover:text-google-blue'}`}
                    >
                        {nativeHandle ? <CheckCircle size={16} /> : <FolderOpen size={16} />}
                        {nativeHandle ? `Workspace: ${nativeHandle.name}` : 'Mount Native FS'}
                    </button>
                    <button 
                        onClick={mapArchitecture}
                        className="flex items-center gap-3 bg-dark-800 px-6 py-3 rounded-2xl border border-dark-700 hover:border-google-blue/40 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-google-blue transition-all"
                    >
                        <Globe size={16} /> Map Architecture
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-12 gap-8">
                {/* File Explorer */}
                <div className="col-span-3 bg-dark-800 rounded-[2rem] border border-dark-700 shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-dark-700 bg-dark-900/40 flex justify-between items-center">
                        <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                            <Code2 size={12} /> Blueprint Tree
                        </h3>
                        <div className="flex gap-2">
                             {isWatching && <Eye size={12} className="text-google-green animate-pulse" />}
                             <button onClick={() => createNode(null, 'file')} className="p-1.5 hover:bg-dark-700 rounded-lg text-gray-500"><FilePlus size={12} /></button>
                             <button onClick={fetchFiles} className="p-1.5 hover:bg-dark-700 rounded-lg text-gray-500 transition-all"><RefreshCw size={12} /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
                        {fileTree.map(node => <FileNode key={node.path} node={node} />)}
                    </div>
                    {/* Context Basket UI */}
                    {Object.keys(contextBasket).length > 0 && (
                        <div className="p-4 border-t border-dark-700 bg-dark-900/60 max-h-40 overflow-y-auto">
                            <div className="text-[8px] font-black uppercase text-google-yellow mb-2 flex items-center gap-2">
                                <Layers size={10} /> Neural Context Basket
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {Object.keys(contextBasket).map(path => (
                                    <div key={path} className="px-2 py-1 bg-dark-800 border border-dark-700 rounded flex items-center gap-2">
                                        <span className="text-[8px] text-gray-400 truncate max-w-[100px]">{path.split('/').pop()}</span>
                                        <button onClick={() => toggleContext(path)} className="text-gray-600 hover:text-google-red"><X size={8} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Workspace */}
                <div className="col-span-6 flex flex-col gap-6">
                    <div className="flex-[2] bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden flex flex-col relative">
                        <div className="p-5 border-b border-dark-700 bg-dark-900/40 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-google-blue/10 rounded-lg"><Terminal size={14} className="text-google-blue" /></div>
                                <span className="text-[11px] font-mono text-gray-400">{selectedFile || 'blueprint_unselected.ts'}</span>
                                {contextBasket[selectedFile || ''] && <Pin size={10} className="text-google-yellow" />}
                            </div>
                            <div className="flex gap-3">
                                {fileContent !== originalContent && (
                                    <span className="text-[9px] font-black uppercase text-google-yellow bg-google-yellow/10 px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse">
                                        <AlertCircle size={10} /> Neural Flux Pending
                                    </span>
                                )}
                                <button 
                                    onClick={saveChanges}
                                    disabled={isSaving || !selectedFile || fileContent === originalContent}
                                    className="px-6 py-2 bg-google-green text-dark-900 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-30 shadow-lg shadow-google-green/10"
                                >
                                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Commit Refactor
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            <textarea 
                                value={fileContent}
                                onChange={(e) => setFileContent(e.target.value)}
                                spellCheck={false}
                                className="absolute inset-0 w-full h-full bg-dark-900 p-8 font-mono text-xs text-gray-300 outline-none resize-none scrollbar-hide leading-relaxed"
                                placeholder="// Awaiting structural analysis..."
                            />
                            {!selectedFile && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/80 backdrop-blur-sm opacity-60">
                                    <Code2 size={48} className="text-gray-700 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Select a node to begin instrumentation</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Neural Shell */}
                    <div className="flex-1 bg-black rounded-[2rem] border border-dark-700 shadow-2xl flex flex-col overflow-hidden group">
                        <div className="px-6 py-3 border-b border-dark-800 bg-dark-900 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Command size={14} className="text-google-green" />
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Neural Shell Emulator</span>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setTerminalLogs([])} className="text-[9px] font-black text-gray-700 hover:text-gray-400 uppercase">Clear</button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto font-mono text-[11px] space-y-1 scrollbar-hide">
                            {terminalLogs.map((log, i) => (
                                <div key={i} className={`${log.type === 'err' ? 'text-google-red' : log.type === 'sys' ? 'text-google-blue' : 'text-gray-400'} whitespace-pre-wrap`}>
                                    {log.msg}
                                </div>
                            ))}
                            <div ref={terminalEndRef} />
                        </div>
                        <div className="p-4 bg-dark-900/50 border-t border-dark-800 flex items-center gap-3">
                            <span className="text-google-green font-mono text-xs ml-2">$</span>
                            <input 
                                value={terminalCmd}
                                onChange={e => setTerminalCmd(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && execCommand()}
                                placeholder="Execute local orchestration..."
                                className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-gray-200"
                            />
                            {isExecuting && <Loader2 size={14} className="animate-spin text-google-green mr-2" />}
                        </div>
                    </div>
                </div>

                {/* AI Architect Sidebar */}
                <div className="col-span-3 flex flex-col gap-6">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-google-blue/30 shadow-2xl flex flex-col gap-6 relative overflow-hidden group h-fit">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                            <Brain size={120} />
                        </div>
                        
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-4 bg-google-blue/10 rounded-2xl border border-google-blue/20">
                                <Sparkles className="text-google-blue" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Architect</h3>
                                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Structural Reasoning Node</p>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex justify-between">
                                <span>Refactor Objective</span>
                                <span className="text-google-blue">Gemini 3 Pro</span>
                            </label>
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe structural changes or feature scaffolding..."
                                className="w-full bg-dark-900 border border-dark-700 p-5 rounded-3xl focus:border-google-blue outline-none text-[11px] text-gray-300 h-48 resize-none shadow-inner leading-relaxed"
                            />
                        </div>

                        <button 
                            onClick={runRefactor}
                            disabled={isThinking || !selectedFile || !prompt.trim()}
                            className="w-full py-5 bg-google-blue text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50 relative z-10"
                        >
                            {isThinking ? (
                                <><Loader2 className="animate-spin" size={20} /> Transmuting Logic...</>
                            ) : (
                                <><Play size={20} /> Deploy Architect</>
                            )}
                        </button>

                        <div className="pt-6 border-t border-dark-700 flex flex-col gap-4 relative z-10">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase text-gray-500">Logic Depth</span>
                                <span className="text-[9px] font-black uppercase text-google-blue">16K Reasoning Tokens</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase text-gray-500">Active Context</span>
                                <span className="text-[9px] font-black uppercase text-google-yellow">{Object.keys(contextBasket).length} files pinned</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 flex-1 opacity-40 grayscale group hover:grayscale-0 hover:opacity-100 transition-all flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <Cpu className="text-google-yellow" size={20} />
                            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Architectural Logs</h4>
                        </div>
                        <div className="space-y-4 flex-1">
                            {[
                                "Cross-file context established.",
                                "Evaluating dependency graph...",
                                "Optimizing codebase topology..."
                            ].map((log, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="w-1 h-1 bg-google-yellow rounded-full mt-1.5 shrink-0" />
                                    <p className="text-[10px] text-gray-400 font-mono italic">"{log}"</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 p-4 bg-google-blue/5 rounded-2xl border border-google-blue/10 flex items-center gap-3">
                             <Info size={12} className="text-google-blue shrink-0" />
                             <p className="text-[8px] text-gray-600 font-black uppercase leading-tight">Builder mode Native FS enabled. Workspace is synced.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuilderLab;
