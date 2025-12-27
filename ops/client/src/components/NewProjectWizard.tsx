import React, { useState } from 'react';
import {
    X, ChevronRight, ChevronLeft, Check, Loader2,
    FileText, Bot, Sparkles, Rocket, AlertCircle
} from 'lucide-react';
import { DirectorModel, NewProjectData } from '../types';

interface NewProjectWizardProps {
    models: DirectorModel[];
    onClose: () => void;
    onCreate: (data: NewProjectData) => Promise<{ success: boolean; error?: string }>;
}

type WizardStep = 'identity' | 'agent' | 'instructions' | 'confirm';

const steps: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: 'identity', label: 'Project Identity', icon: <FileText size={18} /> },
    { id: 'agent', label: 'Select Director', icon: <Bot size={18} /> },
    { id: 'instructions', label: 'Instructions', icon: <Sparkles size={18} /> },
    { id: 'confirm', label: 'Start Project', icon: <Rocket size={18} /> }
];

const NewProjectWizard: React.FC<NewProjectWizardProps> = ({ models, onClose, onCreate }) => {
    const [currentStep, setCurrentStep] = useState<WizardStep>('identity');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form data
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [instructions, setInstructions] = useState('');

    const currentStepIndex = steps.findIndex(s => s.id === currentStep);

    const canProceed = () => {
        switch (currentStep) {
            case 'identity':
                return name.trim().length > 0;
            case 'agent':
                return selectedModel.length > 0;
            case 'instructions':
                return instructions.trim().length > 0;
            case 'confirm':
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStep(steps[currentStepIndex + 1].id);
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1].id);
        }
    };

    const handleCreate = async () => {
        setIsCreating(true);
        setError(null);

        const result = await onCreate({
            name: name.trim(),
            description: description.trim() || undefined,
            instructions: instructions.trim(),
            directorModel: selectedModel
        });

        if (!result.success) {
            setError(result.error || 'Failed to create project');
            setIsCreating(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 'identity':
                return (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">
                                Project Name <span className="text-google-red">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter a memorable project name"
                                className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl text-white outline-none focus:border-google-blue transition-all"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">
                                Description <span className="text-gray-600">(optional)</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of what this project aims to achieve"
                                rows={3}
                                className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl text-white outline-none focus:border-google-blue transition-all resize-none"
                            />
                        </div>
                    </div>
                );

            case 'agent':
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500 mb-4">
                            Select an AI model to act as the Director for this project.
                            The Director will analyze requirements, create execution plans, and spawn sub-agents.
                        </p>
                        <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2">
                            {models.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Bot size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No models available</p>
                                    <p className="text-xs mt-1">Configure API keys in settings</p>
                                </div>
                            ) : (
                                models.map((model) => (
                                    <button
                                        key={model.id}
                                        onClick={() => setSelectedModel(model.id)}
                                        className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                                            selectedModel === model.id
                                                ? 'bg-google-blue/10 border-google-blue'
                                                : 'bg-dark-900 border-dark-700 hover:border-google-blue/50'
                                        }`}
                                    >
                                        <div className={`p-3 rounded-xl ${
                                            selectedModel === model.id
                                                ? 'bg-google-blue text-white'
                                                : 'bg-dark-800 text-gray-400'
                                        }`}>
                                            <Bot size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white">{model.name}</span>
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-dark-800 rounded text-gray-500">
                                                    {model.provider}
                                                </span>
                                            </div>
                                            {model.description && (
                                                <p className="text-xs text-gray-500 line-clamp-2">
                                                    {model.description}
                                                </p>
                                            )}
                                        </div>
                                        {selectedModel === model.id && (
                                            <Check size={20} className="text-google-blue shrink-0" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                );

            case 'instructions':
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">
                            Provide detailed instructions for what you want the Director agent to accomplish.
                            Be specific about goals, constraints, and expected outcomes.
                        </p>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 mb-2">
                                Project Instructions <span className="text-google-red">*</span>
                            </label>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder={`Example:

Build a modern landing page for our SaaS product with:
- Hero section with compelling headline
- Feature highlights with icons
- Pricing table with 3 tiers
- Customer testimonials
- FAQ accordion
- Newsletter signup form

Use React, TailwindCSS, and ensure mobile responsiveness.
Optimize for Core Web Vitals.`}
                                rows={10}
                                className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl text-white outline-none focus:border-google-blue transition-all resize-none font-mono text-sm"
                            />
                        </div>
                        <div className="text-xs text-gray-600">
                            Tip: The more detail you provide, the better the Director can plan and execute.
                        </div>
                    </div>
                );

            case 'confirm':
                return (
                    <div className="space-y-6">
                        <div className="bg-dark-900 p-6 rounded-xl border border-dark-700 space-y-4">
                            <div>
                                <div className="text-[10px] font-black uppercase text-gray-500 mb-1">Project Name</div>
                                <div className="text-lg font-bold text-white">{name}</div>
                            </div>
                            {description && (
                                <div>
                                    <div className="text-[10px] font-black uppercase text-gray-500 mb-1">Description</div>
                                    <div className="text-sm text-gray-400">{description}</div>
                                </div>
                            )}
                            <div>
                                <div className="text-[10px] font-black uppercase text-gray-500 mb-1">Director Agent</div>
                                <div className="text-sm text-google-blue font-bold">
                                    {models.find(m => m.id === selectedModel)?.name || selectedModel}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase text-gray-500 mb-1">Instructions</div>
                                <div className="text-sm text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                    {instructions}
                                </div>
                            </div>
                        </div>

                        <div className="bg-google-blue/10 border border-google-blue/20 p-4 rounded-xl">
                            <div className="flex items-start gap-3">
                                <Sparkles size={18} className="text-google-blue shrink-0 mt-0.5" />
                                <div className="text-sm text-gray-300">
                                    <p className="font-bold text-google-blue mb-1">What happens next:</p>
                                    <ol className="list-decimal list-inside space-y-1 text-xs text-gray-400">
                                        <li>Project will be created with a bootstrap mission</li>
                                        <li>You can spawn the Director agent when ready</li>
                                        <li>The Director will analyze and create an execution plan</li>
                                        <li>Sub-agents will be spawned for specific tasks</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-google-red/10 border border-google-red/20 p-4 rounded-xl flex items-center gap-3">
                                <AlertCircle size={18} className="text-google-red shrink-0" />
                                <p className="text-sm text-google-red">{error}</p>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 rounded-2xl md:rounded-[2rem] border border-dark-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-dark-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-white">New Project</h2>
                        <p className="text-xs text-gray-500">Step {currentStepIndex + 1} of {steps.length}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Step Indicators */}
                <div className="px-4 md:px-6 py-4 border-b border-dark-700 overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-max">
                        {steps.map((step, i) => (
                            <React.Fragment key={step.id}>
                                <button
                                    onClick={() => i < currentStepIndex && setCurrentStep(step.id)}
                                    disabled={i > currentStepIndex}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                        step.id === currentStep
                                            ? 'bg-google-blue text-white'
                                            : i < currentStepIndex
                                                ? 'bg-google-green/10 text-google-green cursor-pointer hover:bg-google-green/20'
                                                : 'bg-dark-900 text-gray-600'
                                    }`}
                                >
                                    {i < currentStepIndex ? <Check size={14} /> : step.icon}
                                    <span className="hidden sm:inline">{step.label}</span>
                                </button>
                                {i < steps.length - 1 && (
                                    <ChevronRight size={16} className="text-gray-700 shrink-0" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {renderStepContent()}
                </div>

                {/* Footer */}
                <div className="p-4 md:p-6 border-t border-dark-700 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={currentStepIndex === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-dark-900 border border-dark-700 text-gray-400 rounded-xl text-[10px] font-black uppercase hover:text-white hover:border-google-blue transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                        Back
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-500 text-[10px] font-black uppercase hover:text-white transition-all"
                        >
                            Cancel
                        </button>
                        {currentStep === 'confirm' ? (
                            <button
                                onClick={handleCreate}
                                disabled={isCreating}
                                className="flex items-center gap-2 px-6 py-3 bg-google-green text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-google-green/20 hover:scale-105 transition-all disabled:opacity-50"
                            >
                                {isCreating ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Rocket size={16} />
                                )}
                                Create Project
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                disabled={!canProceed()}
                                className="flex items-center gap-2 px-6 py-3 bg-google-blue text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-google-blue/20 hover:scale-105 transition-all disabled:opacity-50"
                            >
                                Next
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewProjectWizard;
