import { useEvaluationStore } from '../store/evaluationStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { 
  User, 
  Briefcase, 
  Clock, 
  Star, 
  TrendingUp, 
  Copy,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

export function CandidateDrawer() {
  const { selectedCandidate, setSelectedCandidate, results } = useEvaluationStore();
  const [copiedJson, setCopiedJson] = useState(false);

  if (!selectedCandidate) return null;

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'advance': return <CheckCircle className="w-4 h-4 text-success" />;
      case 'hold': return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'reject': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getDecisionBadgeVariant = (decision: string) => {
    switch (decision) {
      case 'advance': return 'default';
      case 'hold': return 'secondary';
      case 'reject': return 'destructive';
      default: return 'secondary';
    }
  };

  // Prepare chart data
  const radarData = results?.meta.agentsUsed.map(agent => ({
    agent: agent.charAt(0).toUpperCase() + agent.slice(1),
    score: selectedCandidate.scores?.[agent] || 0,
    fullMark: 1
  })) || [];

  const barData = Object.entries(selectedCandidate.scores || {}).map(([agent, score]) => ({
    agent: agent.charAt(0).toUpperCase() + agent.slice(1),
    score: score
  }));

  const timelineData = selectedCandidate.timeline?.stages?.map((stage, index) => ({
    stage: stage.name,
    duration: stage.ms,
    order: index
  })) || [];

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedCandidate, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (error) {
      console.error('Failed to copy JSON:', error);
    }
  };

  return (
    <Sheet open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-6">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-2xl font-bold mb-2">
                {selectedCandidate.name}
              </SheetTitle>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Briefcase className="w-4 h-4" />
                <span>
                  {selectedCandidate.currentTitle}
                  {selectedCandidate.currentCompany && ` at ${selectedCandidate.currentCompany}`}
                </span>
              </div>
              {selectedCandidate.yearsExperience && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{selectedCandidate.yearsExperience} years experience</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary mb-1">
                {(selectedCandidate.finalScore * 100).toFixed(0)}%
              </div>
              <Badge variant={getDecisionBadgeVariant(selectedCandidate.decision)} className="mb-2">
                <div className="flex items-center gap-1">
                  {getDecisionIcon(selectedCandidate.decision)}
                  {selectedCandidate.decision.toUpperCase()}
                </div>
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Candidate Profile
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <div className="font-medium">{selectedCandidate.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Role:</span>
                  <div className="font-medium">{selectedCandidate.currentTitle || 'Not specified'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Company:</span>
                  <div className="font-medium">{selectedCandidate.currentCompany || 'Not specified'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Experience:</span>
                  <div className="font-medium">
                    {selectedCandidate.yearsExperience ? `${selectedCandidate.yearsExperience} years` : 'Not specified'}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" />
                Key Highlights
              </h3>
              {selectedCandidate.insights && selectedCandidate.insights.length > 0 ? (
                <ul className="space-y-2">
                  {selectedCandidate.insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No specific insights available.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Final Decision
              </h3>
              <div className="flex items-center gap-3 mb-3">
                {getDecisionIcon(selectedCandidate.decision)}
                <span className="font-medium text-lg capitalize">{selectedCandidate.decision}</span>
                <Badge variant={getDecisionBadgeVariant(selectedCandidate.decision)}>
                  {(selectedCandidate.finalScore * 100).toFixed(0)}% Match
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on comprehensive evaluation across {Object.keys(selectedCandidate.scores || {}).length} criteria.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="scores" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Score Breakdown</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="agent" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Score']} />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-4">Competency Profile</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="agent" />
                    <PolarRadiusAxis domain={[0, 1]} tick={false} />
                    <Radar 
                      name="Score" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.3} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Detailed Rationale</h3>
              <div className="space-y-4">
                {Object.entries(selectedCandidate.agentRationales || {}).map(([agent, rationale]) => (
                  <div key={agent} className="border-l-4 border-primary pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium capitalize">{agent}</h4>
                      <Badge variant="outline">
                        {((selectedCandidate.scores?.[agent] || 0) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rationale}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Processing Timeline
              </h3>
              
              {selectedCandidate.timeline && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                    <div>
                      <span className="text-muted-foreground">Started:</span>
                      <div className="font-medium">
                        {selectedCandidate.timeline.startedAt ? 
                          format(new Date(selectedCandidate.timeline.startedAt), 'PPpp') : 
                          'Not available'
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <div className="font-medium">
                        {selectedCandidate.timeline.endedAt ? 
                          format(new Date(selectedCandidate.timeline.endedAt), 'PPpp') : 
                          'Not available'
                        }
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {timelineData.map((stage, index) => (
                      <div key={index} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{stage.stage}</div>
                          <div className="text-sm text-muted-foreground">{stage.duration}ms</div>
                        </div>
                        <div className="text-right">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div 
                              className="h-2 bg-primary rounded-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min(100, (stage.duration / Math.max(...timelineData.map(s => s.duration))) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Total processing time: {timelineData.reduce((sum, stage) => sum + stage.duration, 0)}ms
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="json" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Raw JSON Data</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedJson ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs text-foreground whitespace-pre-wrap">
                  {JSON.stringify(selectedCandidate, null, 2)}
                </pre>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}