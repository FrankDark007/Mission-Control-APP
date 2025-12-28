/**
 * FileUpload Component
 * Drag-and-drop file upload with AI analysis options
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, File, FileArchive, X, Loader2, Brain,
  Search, FileText, Sparkles, ChevronDown, Check,
  Folder, Image, Code
} from 'lucide-react';

interface ExtractedFile {
  path: string;
  type: string;
  size: number;
}

interface UploadMetadata {
  id: string;
  projectId: string | null;
  originalName: string;
  size: number;
  uploadedAt: string;
  processed: boolean;
  extractedFiles: ExtractedFile[];
  analysis?: any;
}

interface FileUploadProps {
  projectId?: string;
  onUploadComplete?: (upload: UploadMetadata) => void;
  onAnalysisComplete?: (result: any) => void;
}

const analysisTypes = [
  { id: 'seo', name: 'SEO Audit', icon: Search, description: 'Analyze meta tags, keywords, and optimization' },
  { id: 'competitor', name: 'Competitor Research', icon: Brain, description: 'Research market position and gaps' },
  { id: 'content', name: 'Content Generation', icon: FileText, description: 'Generate SEO-optimized content suggestions' },
  { id: 'overview', name: 'General Overview', icon: Sparkles, description: 'Comprehensive site analysis' }
];

const aiModels = [
  { id: 'claude-code', name: 'Claude Code', description: 'Full context analysis with code execution', recommended: true },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast analysis', recommended: false },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Detailed analysis', recommended: false },
  { id: 'perplexity', name: 'Perplexity', description: 'Web-grounded research', recommended: false }
];

const fileTypeIcons: Record<string, React.ReactNode> = {
  html: <Code size={14} className="text-orange-400" />,
  css: <Code size={14} className="text-blue-400" />,
  javascript: <Code size={14} className="text-yellow-400" />,
  typescript: <Code size={14} className="text-blue-500" />,
  image: <Image size={14} className="text-green-400" />,
  json: <FileText size={14} className="text-purple-400" />,
  other: <File size={14} className="text-gray-400" />
};

const FileUpload: React.FC<FileUploadProps> = ({
  projectId,
  onUploadComplete,
  onAnalysisComplete
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [upload, setUpload] = useState<UploadMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState('seo');
  const [selectedModel, setSelectedModel] = useState('claude-code');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  }, [projectId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  }, [projectId]);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUpload(null);
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = projectId
        ? `/api/uploads/projects/${projectId}`
        : '/api/uploads';

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setUpload(data.upload);
        onUploadComplete?.(data.upload);
      } else {
        console.error('Upload failed:', data.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const runAnalysis = async () => {
    if (!upload) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const res = await fetch(`/api/uploads/${upload.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisType: selectedAnalysis,
          model: selectedModel
        })
      });

      const data = await res.json();
      if (data.success) {
        setAnalysisResult(data.result.analysis || JSON.stringify(data.result.research, null, 2));
        onAnalysisComplete?.(data.result);
      } else {
        setAnalysisResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setAnalysisResult(`Error: ${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearUpload = () => {
    setUpload(null);
    setAnalysisResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {!upload && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-google-blue bg-google-blue/10'
              : 'border-dark-600 hover:border-dark-500 bg-dark-800/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".zip,.html,.css,.js,.jsx,.ts,.tsx,.json,.md,.txt"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={40} className="text-google-blue animate-spin" />
              <p className="text-sm text-gray-400">Uploading and processing...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-dark-700 rounded-full">
                <Upload size={32} className="text-google-blue" />
              </div>
              <div>
                <p className="text-white font-medium">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports ZIP, HTML, CSS, JS, JSON, Markdown
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uploaded File */}
      {upload && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          {/* File Header */}
          <div className="flex items-center gap-3 p-4 border-b border-dark-600">
            <div className="p-2 bg-dark-700 rounded-lg">
              {upload.originalName.endsWith('.zip') ? (
                <FileArchive size={24} className="text-google-yellow" />
              ) : (
                <File size={24} className="text-google-blue" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white truncate">{upload.originalName}</h4>
              <p className="text-xs text-gray-500">
                {formatSize(upload.size)} • {upload.extractedFiles?.length || 0} files extracted
              </p>
            </div>
            <button
              onClick={clearUpload}
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {/* Extracted Files */}
          {upload.extractedFiles?.length > 0 && (
            <div className="border-b border-dark-600">
              <button
                onClick={() => setShowFiles(!showFiles)}
                className="w-full flex items-center justify-between p-3 hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Folder size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-400">
                    {upload.extractedFiles.length} files extracted
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform ${showFiles ? 'rotate-180' : ''}`}
                />
              </button>

              {showFiles && (
                <div className="max-h-48 overflow-y-auto px-3 pb-3">
                  <div className="space-y-1">
                    {upload.extractedFiles.slice(0, 50).map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 py-1 px-2 bg-dark-700/50 rounded text-xs"
                      >
                        {fileTypeIcons[file.type] || fileTypeIcons.other}
                        <span className="text-gray-300 truncate flex-1">{file.path}</span>
                        <span className="text-gray-500">{formatSize(file.size)}</span>
                      </div>
                    ))}
                    {upload.extractedFiles.length > 50 && (
                      <p className="text-xs text-gray-500 text-center py-2">
                        +{upload.extractedFiles.length - 50} more files
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analysis Options */}
          <div className="p-4 space-y-4">
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              AI Analysis
            </h5>

            {/* Analysis Type */}
            <div className="grid grid-cols-2 gap-2">
              {analysisTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedAnalysis(type.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                      selectedAnalysis === type.id
                        ? 'border-google-blue bg-google-blue/10'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <Icon size={16} className={selectedAnalysis === type.id ? 'text-google-blue' : 'text-gray-400'} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${selectedAnalysis === type.id ? 'text-white' : 'text-gray-300'}`}>
                        {type.name}
                      </p>
                    </div>
                    {selectedAnalysis === type.id && (
                      <Check size={14} className="text-google-blue" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Model Selection */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">AI Model</label>
              <div className="grid grid-cols-2 gap-2">
                {aiModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left ${
                      selectedModel === model.id
                        ? 'border-google-blue bg-google-blue/10'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${selectedModel === model.id ? 'text-white' : 'text-gray-300'}`}>
                        {model.name}
                      </span>
                      {model.recommended && (
                        <span className="px-1.5 py-0.5 bg-google-green/20 text-google-green text-[8px] font-bold uppercase rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-0.5">{model.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                isAnalyzing
                  ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
                  : 'bg-google-blue text-white hover:bg-google-blue/80'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Run {analysisTypes.find(t => t.id === selectedAnalysis)?.name}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-dark-600 bg-dark-700/50">
            <Brain size={16} className="text-google-green" />
            <span className="text-sm font-medium text-white">Analysis Result</span>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
              {analysisResult}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
