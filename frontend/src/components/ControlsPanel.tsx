import { useState, useEffect } from 'react';
import { useEvaluationStore, type AgentKey } from '../store/evaluationStore';
import { transformApiResponse } from '../store/evaluationStore';
import { evaluate, fetchJobDescription } from '../services/apiServices';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Slider } from './ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { toast } from '../hooks/use-toast';
import { 
  Play, 
  RotateCcw, 
  Link, 
  ChevronDown, 
  Brain, 
  User, 
  Briefcase, 
  Heart,
  Settings,
  Loader2
} from 'lucide-react';

const agents: Array<{ key: AgentKey; label: string; icon: any; description: string }> = [
  { key: 'experience', label: 'Experience', icon: Briefcase, description: 'Evaluates work history and career progression' },
  { key: 'skills', label: 'Skills', icon: Brain, description: 'Assesses technical and domain expertise' },
  { key: 'culture', label: 'Culture', icon: Heart, description: 'Analyzes cultural fit and values alignment' },
];

export function ControlsPanel() {
  const {
    jobDescription,
    jobUrl,
    selectedAgents,
    candidateCount,
    customCandidateCount,
    temperature,
    modelTag,
    requestNotes,

    isEvaluating,
    setJobDescription,
    setJobUrl,
    setSelectedAgents,
    setCandidateCount,
    setCustomCandidateCount,
    setTemperature,
    setModelTag,
    setRequestNotes,
    setIsEvaluating,
    setResults,
    reset,
  } = useEvaluationStore();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isFetchingJD, setIsFetchingJD] = useState(false);
  const [useCustomCount, setUseCustomCount] = useState(false);

  // Validation
  const isFormValid = 
    selectedAgents.length > 0 && 
    (jobDescription.length >= 30 || jobUrl.trim().length > 0) &&
    (useCustomCount ? customCandidateCount >= 1 && customCandidateCount <= 100 : true);

  const handleAgentToggle = (agentKey: AgentKey, checked: boolean) => {
    if (checked) {
      setSelectedAgents([...selectedAgents, agentKey]);
    } else {
      setSelectedAgents(selectedAgents.filter(key => key !== agentKey));
    }
  };

  const handleSelectAllAgents = (checked: boolean) => {
    if (checked) {
      setSelectedAgents(['experience', 'skills', 'culture']);
    } else {
      setSelectedAgents([]);
    }
  };

  const handleFetchJobDescription = async () => {
    if (!jobUrl.trim()) return;
    
    setIsFetchingJD(true);
    try {
      const description = await fetchJobDescription(jobUrl);
      setJobDescription(description);
      toast({
        title: "Job description fetched",
        description: "Successfully loaded job description from URL.",
      });
    } catch (error) {
      toast({
        title: "Error fetching job description",
        description: "Failed to load job description from the provided URL.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingJD(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (!isFormValid) return;
    
    setIsEvaluating(true);
    const finalCount = useCustomCount ? customCandidateCount : candidateCount;
    
    try {
      const apiResponse = await evaluate(
        jobDescription || `Job from URL: ${jobUrl}`,
        selectedAgents,
        finalCount
      );
      const transformedResults = transformApiResponse(apiResponse);
      setResults(transformedResults);
      toast({
        title: "Evaluation completed",
        description: `Successfully evaluated ${transformedResults.candidates.length} candidates.`,
      });
    } catch (error) {
      toast({
        title: "Evaluation failed",
        description: "An error occurred during candidate evaluation.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Keyboard shortcut for run evaluation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (isFormValid && !isEvaluating) {
          handleRunEvaluation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormValid, isEvaluating]);

  return (
    <Card className="p-6 h-fit shadow-elegant animate-fade-in">
      <div className="space-y-6">
        {/* Job Source */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Job Source
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="job-description" className="text-sm font-medium text-foreground">
                Job Description
              </Label>
              <Textarea
                id="job-description"
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="mt-1 min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {jobDescription.length} characters (minimum 30 required)
              </p>
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="job-url" className="text-sm font-medium text-foreground">
                  Or Job URL
                </Label>
                <Input
                  id="job-url"
                  type="url"
                  placeholder="https://company.com/jobs/123"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleFetchJobDescription}
                disabled={!jobUrl.trim() || isFetchingJD}
                className="mt-6"
              >
                {isFetchingJD ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* AI Agents */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Evaluators
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedAgents.length === 3}
                onCheckedChange={handleSelectAllAgents}
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Select All Agents
              </Label>
            </div>
            
            {agents.map((agent) => (
              <div key={agent.key} className="flex items-start space-x-3 p-3 rounded-lg border bg-card/50">
                <Checkbox
                  id={agent.key}
                  checked={selectedAgents.includes(agent.key)}
                  onCheckedChange={(checked) => handleAgentToggle(agent.key, !!checked)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <agent.icon className="h-4 w-4 text-primary" />
                    <Label htmlFor={agent.key} className="text-sm font-medium">
                      {agent.label}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {agent.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Candidate Count */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Candidate Count
          </h3>
          
          <RadioGroup 
            value={useCustomCount ? 'custom' : candidateCount.toString()} 
            onValueChange={(value) => {
              if (value === 'custom') {
                setUseCustomCount(true);
              } else {
                setUseCustomCount(false);
                setCandidateCount(parseInt(value) as 5 | 10 | 20);
              }
            }}
            className="grid grid-cols-2 gap-2"
          >
            {[5, 10, 20].map((count) => (
              <div key={count} className="flex items-center space-x-2">
                <RadioGroupItem value={count.toString()} id={`count-${count}`} />
                <Label htmlFor={`count-${count}`} className="text-sm">
                  {count} candidates
                </Label>
              </div>
            ))}
            <div className="col-span-2 flex items-center space-x-2">
              <RadioGroupItem value="custom" id="count-custom" />
              <Label htmlFor="count-custom" className="text-sm">Custom:</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={customCandidateCount}
                onChange={(e) => setCustomCandidateCount(parseInt(e.target.value) || 1)}
                className="w-20 h-8"
                disabled={!useCustomCount}
              />
            </div>
          </RadioGroup>
        </div>

        {/* Advanced Options */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">Advanced Options</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium text-foreground">
                Temperature: {temperature}
              </Label>
              <Slider
                value={[temperature]}
                onValueChange={([value]) => setTemperature(value)}
                max={1}
                min={0}
                step={0.1}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Controls randomness in AI responses (0 = deterministic, 1 = creative)
              </p>
            </div>
            
            <div>
              <Label htmlFor="model-tag" className="text-sm font-medium text-foreground">
                Model Tag
              </Label>
              <Input
                id="model-tag"
                value={modelTag}
                onChange={(e) => setModelTag(e.target.value)}
                placeholder="gpt-4"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="request-notes" className="text-sm font-medium text-foreground">
                Request Notes
              </Label>
              <Textarea
                id="request-notes"
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Additional instructions for the AI evaluators..."
                className="mt-1"
                rows={3}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleRunEvaluation}
            disabled={!isFormValid || isEvaluating}
            className="flex-1 bg-gradient-primary hover:shadow-glow transition-all duration-300"
            size="lg"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Evaluation
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={reset}
            disabled={isEvaluating}
            size="lg"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        
        
        <p className="text-xs text-muted-foreground text-center">
          Press Ctrl/Cmd + Enter to run evaluation
        </p>
      </div>
    </Card>
  );
}
