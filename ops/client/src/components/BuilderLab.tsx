
import React, { useState, useEffect, useRef } from 'react';
import { 
    Hammer, FileCode, Folder, ChevronRight, ChevronDown, 
    Save, Play, Loader2, Sparkles, Brain, Cpu, 
    Terminal, Zap, Search, AlertCircle, CheckCircle, Code2,
    Plus, Trash2, FolderPlus, FilePlus, X, Globe, Command,
    Layers, Pin, PinOff, Info, RefreshCw, FolderOpen, Eye, ShieldAlert, Filter
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
    const [lintReports, setLintReports] = useState<any[]>([]);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [isSearching, setIsSearching] = useState(false);

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

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch('/api/builder/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery })
            });
            const data = await res.json();
            setSearchResults(data.results);
        } finally {
            setIsSearching(false);
        }
    };

    const runNeuralLint = async (path: string, content: string) => {
        try {
            const res = await fetch('/api/builder/lint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, content })
            });
            const data = await res.json();
            if (data.reports) setLintReports(data.reports);
        } catch (e) {
            console.error('Linting failed', e);
        }
    };

    useEffect(() => { 
        fetchFiles(); 
        setTerminalLogs([{ msg: "Neural Shell v4.2 Initialized. Context-aware orchestration online.", type: 'sys' }]);
    }, []);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalLogs]);

    const handleNativeMount = async () => {
        try {
            const handle = await (window as any).showDirectoryPicker();
            setNativeHandle(handle);
            addTermLog(`Native File System Access granted to: ${handle.name}`, 'sys');
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
        setLintReports([]);
        runNeuralLint(path, data.content);
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
                    message: `Refactor target file: ${selectedFile}\nInstruction: ${prompt}\n\n${contextStr}\n\nTARGET CONTENT:\n${fileContent}`,
                    model: 'gemini-3-pro-preview',
                    systemInstruction: "You are a World-Class Software Architect. Return FULL updated content for target file only. Preserve existing exports. Return ONLY code, no markdown.",
                    thinkingBudget: 16000
                })
            });
            const data = await res.json();
            const cleaned = (data.text || '').replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();
            setFileContent(cleaned);
            addTermLog(`Architectural transmutation complete for ${selectedFile}.`, 'sys');
            runNeuralLint(selectedFile, cleaned);
        } catch (e) {
            addTermLog(`Refactor Error: Swarm link unstable.`, 'err');
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
                addTermLog(`Changes persisted: ${selectedFile}`, 'sys');
                fetchFiles();
                runNeuralLint(selectedFile, fileContent);
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
        if (!window.confirm(`Delete ${path}?`)) return;
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
                    className={`flex items-center justify-between py-1 px-3 rounded-xl cursor-pointer transition-all group/node ${selectedFile === node.path ? 'bg-google-blue/15 text-google-blue' : 'hover:bg-dark-700 text-gray-400'}`}
                    style={{ paddingLeft: `${depth * 1 + 0.75}rem` }}
                >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 py-1">
                        {isFolder ? (
                            isOpen ? <ChevronDown size={14} className="shrink-0 text-gray-500" /> : <ChevronRight size={14} className="shrink-0 text-gray-500" />
                        ) : <FileCode size={14} className={`shrink-0 ${isPinned ? 'text-google-yellow animate-pulse' : 'text-google-blue/50'}`} />}
                        <span className="text-[11px] font-bold truncate">{node.name}</span>
                        {node.gitStatus && (
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${node.gitStatus === 'M' ? 'bg-google-yellow/10 border-google-yellow/30 text-google-yellow' : 'bg-google-green/10 border-google-green/30 text-google-green'}`}>
                                {node.gitStatus}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2 opacity-0 group/node:opacity-100 transition-opacity">
                        {!isFolder && <button onClick={(e) => { e.stopPropagation(); toggleContext(node.path); }} className={`p-1 rounded hover:bg-dark-600 ${isPinned ? 'text-google-yellow' : 'text-gray-600 hover:text-google-yellow'}`} title="Pin to Context"><Pin size={12} /></button>}
                        {isFolder && <button onClick={(e) => { e.stopPropagation(); createNode(node.path, 'file'); }} className="p-1 rounded hover:bg-dark-600 text-gray-600 hover:text-google-blue"><FilePlus size={12} /></button>}
                        <button onClick={(e) => { e.stopPropagation(); deleteNode(node.path); }} className="p-1 rounded hover:bg-dark-600 text-gray-600 hover:text-google-red"><Trash2 size={12} /></button>
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
        <div className="h-full flex flex-col space-y-4 md:space-y-6 animate-in fade-in pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Builder Studio</h2>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">Global project discovery and architectural refactoring node.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleNativeMount}
                        className={`flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-xl ${nativeHandle ? 'bg-google-green/10 border-google-green text-google-green' : 'bg-dark-800 border-dark-700 text-gray-400 hover:text-google-blue'}`}
                    >
                        {nativeHandle ? <CheckCircle size={16} /> : <FolderOpen size={16} />}
                        <span className="hidden sm:inline">{nativeHandle ? `Workspace: ${nativeHandle.name}` : 'Mount Filesystem'}</span>
                        <span className="sm:hidden">{nativeHandle ? 'Mounted' : 'Mount'}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 lg:gap-8">
                <div className="lg:col-span-3 bg-dark-800 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col overflow-hidden max-h-[400px] lg:max-h-none">
                    <div className="p-4 md:p-6 border-b border-dark-700 bg-dark-900/40 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                                <Code2 size={14} className="text-google-blue" /> Project Intelligence
                            </h3>
                            <div className="flex gap-2">
                                 <button onClick={fetchFiles} className="p-2 hover:bg-dark-700 rounded-xl text-gray-500 transition-colors"><RefreshCw size={14} /></button>
                            </div>
                        </div>
                        {/* Search Feature */}
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-600" size={14} />
                            <input 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Grep codebase..."
                                className="w-full bg-dark-900 border border-dark-700 pl-10 pr-4 py-2 rounded-xl text-[10px] text-white outline-none focus:border-google-blue transition-all"
                            />
                            {isSearching && <Loader2 className="absolute right-3 top-2.5 animate-spin text-google-blue" size={14} />}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                        {searchResults.length > 0 ? (
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between items-center px-2 mb-3">
                                    <span className="text-[8px] font-black uppercase text-google-yellow">Search Results</span>
                                    <button onClick={() => setSearchResults([])} className="text-[8px] font-black uppercase text-gray-600 hover:text-white">Clear</button>
                                </div>
                                {searchResults.map(path => (
                                    <div key={path} onClick={() => selectFile(path)} className="p-2 bg-dark-900 border border-dark-700 rounded-xl text-[10px] text-gray-400 cursor-pointer hover:border-google-yellow hover:text-white transition-all truncate">
                                        {path}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <div className="space-y-1">
                            {fileTree.map(node => <FileNode key={node.path} node={node} />)}
                        </div>
                    </div>

                    {lintReports.length > 0 && (
                        <div className="p-6 border-t border-dark-700 bg-dark-900/60 max-h-56 overflow-y-auto">
                            <div className="text-[10px] font-black uppercase text-google-red mb-4 flex items-center gap-2">
                                <ShieldAlert size={14} /> Neural Audit Results
                            </div>
                            <div className="space-y-3">
                                {lintReports.map((report, i) => (
                                    <div key={i} className="p-3 bg-dark-800 border-l-4 border-google-red rounded-xl text-[10px] text-gray-400 shadow-lg">
                                        <div className="font-black text-white flex justify-between mb-1">
                                            <span>Line {report.line}</span>
                                            <span className="uppercase text-google-red bg-google-red/10 px-2 rounded-full">{report.severity}</span>
                                        </div>
                                        <p className="italic">"{report.message}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-6 flex flex-col gap-4 md:gap-6 lg:gap-8">
                    <div className="flex-[2] min-h-[300px] md:min-h-[400px] bg-dark-800 rounded-2xl md:rounded-[2rem] lg:rounded-[3rem] border border-dark-700 shadow-2xl overflow-hidden flex flex-col relative">
                        <div className="p-4 md:p-6 border-b border-dark-700 bg-dark-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="p-2 md:p-3 bg-google-blue/10 rounded-xl md:rounded-2xl border border-google-blue/20"><Terminal size={18} className="text-google-blue" /></div>
                                <span className="text-[10px] md:text-xs font-mono font-bold text-gray-400 truncate max-w-[150px] md:max-w-none">{selectedFile || 'Awaiting File Selection'}</span>
                            </div>
                            <div className="flex gap-4">
                                {Object.keys(contextBasket).length > 0 && (
                                    <div className="flex -space-x-2 mr-2">
                                        {Object.keys(contextBasket).map(p => (
                                            <div key={p} className="w-8 h-8 rounded-full bg-dark-700 border-2 border-dark-800 flex items-center justify-center text-[8px] font-black text-google-yellow shadow-lg" title={p}>
                                                <Pin size={10} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {fileContent !== originalContent && (
                                    <button 
                                        onClick={saveChanges}
                                        disabled={isSaving || !selectedFile}
                                        className="px-8 py-2.5 bg-google-green text-dark-900 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:scale-105 shadow-xl shadow-google-green/20"
                                    >
                                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        Commit Patch
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 relative">
                            <textarea
                                value={fileContent}
                                onChange={(e) => setFileContent(e.target.value)}
                                spellCheck={false}
                                className="absolute inset-0 w-full h-full bg-dark-900 p-4 md:p-6 lg:p-10 font-mono text-[11px] md:text-xs text-gray-300 outline-none resize-none scrollbar-hide leading-relaxed"
                                placeholder="// Select logic from the Project Tree to begin architectural synthesis..."
                            />
                        </div>
                    </div>

                    <div className="flex-1 min-h-[200px] bg-black rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col overflow-hidden group">
                        <div className="px-4 md:px-8 py-3 md:py-4 border-b border-dark-800 bg-dark-900 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <Command size={16} className="text-google-green" />
                                <span className="text-[11px] font-black uppercase text-gray-500 tracking-widest italic">Neural Shell v4.2</span>
                            </div>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-google-red/40" />
                                <div className="w-2 h-2 rounded-full bg-google-yellow/40" />
                                <div className="w-2 h-2 rounded-full bg-google-green/40" />
                            </div>
                        </div>
                        <div className="flex-1 p-4 md:p-8 overflow-y-auto font-mono text-[10px] md:text-[11px] space-y-1.5 scrollbar-hide">
                            {terminalLogs.map((log, i) => (
                                <div key={i} className={`${log.type === 'err' ? 'text-google-red' : log.type === 'sys' ? 'text-google-blue font-bold' : 'text-gray-400'} whitespace-pre-wrap`}>
                                    {log.type === 'sys' ? '› ' : ''}{log.msg}
                                </div>
                            ))}
                            <div ref={terminalEndRef} />
                        </div>
                        <div className="p-4 md:p-6 bg-dark-900/50 border-t border-dark-800 flex items-center gap-4">
                            <span className="text-google-green font-mono text-sm ml-2 font-black">λ</span>
                            <input value={terminalCmd} onChange={e => setTerminalCmd(e.target.value)} onKeyDown={e => e.key === 'Enter' && execCommand()} placeholder="Command shell..." className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-gray-200" />
                            {isExecuting && <Loader2 size={16} className="animate-spin text-google-green" />}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6 lg:gap-8">
                    <div className="bg-dark-800 p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-[2rem] lg:rounded-[3rem] border border-google-blue/30 shadow-2xl flex flex-col gap-4 md:gap-6 lg:gap-8 relative overflow-hidden group h-fit">
                        <div className="flex items-center gap-3 md:gap-4 relative z-10">
                            <div className="p-3 md:p-4 bg-google-blue/10 rounded-xl md:rounded-[1.5rem] border border-google-blue/20">
                                <Sparkles className="text-google-blue w-6 h-6 md:w-7 md:h-7" />
                            </div>
                            <div>
                                <h3 className="text-xl md:text-2xl font-black text-white italic">Architect</h3>
                                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Autonomous Reasoning</p>
                            </div>
                        </div>
                        <div className="space-y-4 md:space-y-6 relative z-10">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 flex justify-between px-1">
                                    <span>Synthesis goal</span>
                                    <span className="text-google-blue">3 Pro Node</span>
                                </label>
                                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe structural mutations..." className="w-full bg-dark-900 border border-dark-700 p-4 md:p-6 rounded-xl md:rounded-2xl lg:rounded-[2rem] focus:border-google-blue outline-none text-[11px] text-gray-300 h-32 md:h-48 lg:h-64 resize-none shadow-inner leading-relaxed" />
                            </div>
                        </div>
                        <button
                            onClick={runRefactor}
                            disabled={isThinking || !selectedFile || !prompt.trim()}
                            className="w-full py-4 md:py-6 bg-google-blue text-white rounded-xl md:rounded-[1.5rem] font-black uppercase tracking-widest md:tracking-[0.2em] text-xs md:text-sm shadow-2xl shadow-google-blue/20 flex items-center justify-center gap-2 md:gap-3 hover:scale-[1.02] transition-all disabled:opacity-50 relative z-10"
                        >
                            {isThinking ? <Loader2 className="animate-spin" size={20} /> : <><Play size={20} /> Execute</>}
                        </button>
                    </div>

                    <div className="bg-dark-800 p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-dark-700 flex-1 flex flex-col shadow-xl max-h-[300px] lg:max-h-none">
                        <div className="flex items-center justify-between mb-4 md:mb-6 lg:mb-8">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="p-2 md:p-3 bg-google-yellow/10 rounded-lg md:rounded-xl border border-google-yellow/20"><Cpu className="text-google-yellow w-4 h-4 md:w-5 md:h-5" /></div>
                                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Reasoning Logs</h4>
                            </div>
                        </div>
                        <div className="space-y-4 md:space-y-6 flex-1 overflow-y-auto scrollbar-hide pr-2">
                            {["Mapping architectural dependencies...", "Analyzing logic flows...", "Enforcing type safety...", "Optimizing runtime loops..."].map((log, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className="w-px bg-dark-700 group-hover:bg-google-yellow transition-colors" />
                                    <p className="text-[10px] text-gray-500 font-mono italic py-1 leading-relaxed">"{log}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuilderLab;
