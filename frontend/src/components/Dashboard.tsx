import { useEvaluationStore } from '../store/evaluationStore';
import { ControlsPanel } from './ControlsPanel';
import { ResultsPanel } from './ResultsPanel';
import { CandidateDrawer } from './CandidateDrawer';
import { Button } from './ui/button';

import { Brain, Users, Activity } from 'lucide-react';

export function Dashboard() {


  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Intelligent Recruitment</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Candidate Evaluation</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
              </div>
              <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>3 AI Evaluators</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  <span>Real-time Analysis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-5 gap-8 min-h-[calc(100vh-200px)]">
          {/* Controls Panel */}
          <div className="lg:col-span-2">
            <ControlsPanel />
          </div>
          
          {/* Results Panel */}
          <div className="lg:col-span-3">
            <ResultsPanel />
          </div>
        </div>
      </div>

      {/* Candidate Detail Drawer */}
      <CandidateDrawer />
    </div>
  );
}
