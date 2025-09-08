import { useState } from 'react';
import { useEvaluationStore } from '../store/evaluationStore';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line
} from 'recharts';
import { 
  Search,
  SortAsc,
  SortDesc,
  Clock,
  Users,
  Brain,
  TrendingUp,
  Filter,
  Eye,
  ChevronDown,
  BarChart3
} from 'lucide-react';
import type { Candidate } from '../store/evaluationStore';

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-[400px] text-center animate-fade-in">
    <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
      <BarChart3 className="w-12 h-12 text-primary-foreground" />
    </div>
    <h3 className="text-xl font-semibold text-foreground mb-2">
      Ready to Evaluate Candidates
    </h3>
    <p className="text-muted-foreground max-w-md">
      Configure your job requirements and AI evaluators in the left panel, then run an evaluation to see detailed candidate analysis and rankings.
    </p>
  </div>
);

const LoadingState = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary animate-pulse" />
        <Badge variant="secondary" className="animate-pulse">
          Contacting agents...
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary animate-pulse" />
        <Badge variant="secondary" className="animate-pulse">
          Scoring candidates...
        </Badge>
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-32 w-full" />
      </Card>
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-32 w-full" />
      </Card>
    </div>
    
    <Card className="p-6">
      <Skeleton className="h-6 w-40 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  </div>
);

export function ResultsPanel() {
  const { results, isEvaluating, setSelectedCandidate } = useEvaluationStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Candidate>('finalScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  if (isEvaluating) {
    return <LoadingState />;
  }

  if (!results) {
    return <EmptyState />;
  }

  // Filter and sort candidates
  let filteredCandidates = results.candidates.filter(candidate => {
    const searchLower = searchTerm.toLowerCase();
    return (
      candidate.name.toLowerCase().includes(searchLower) ||
      candidate.currentTitle?.toLowerCase().includes(searchLower) ||
      candidate.currentCompany?.toLowerCase().includes(searchLower)
    );
  });

  filteredCandidates.sort((a, b) => {
    const aValue = a[sortField] as any;
    const bValue = b[sortField] as any;
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
    }
    
    const aStr = String(aValue || '');
    const bStr = String(bValue || '');
    
    if (sortDirection === 'desc') {
      return bStr.localeCompare(aStr);
    }
    return aStr.localeCompare(bStr);
  });

  // Pagination
  const totalPages = Math.ceil(filteredCandidates.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCandidates = filteredCandidates.slice(startIndex, startIndex + pageSize);

  // Chart data
  const avgScores = results.meta.agentsUsed.map(agent => ({
    agent: agent.charAt(0).toUpperCase() + agent.slice(1),
    score: results.candidates.reduce((sum, c) => sum + (c.scores?.[agent] || 0), 0) / results.candidates.length
  }));

  const radarData = results.meta.agentsUsed.map(agent => ({
    agent: agent.charAt(0).toUpperCase() + agent.slice(1),
    value: results.candidates.reduce((sum, c) => sum + (c.scores?.[agent] || 0), 0) / results.candidates.length
  }));

  const timelineData = results.candidates.slice(0, 10).map((candidate, index) => ({
    rank: index + 1,
    name: candidate.name.split(' ')[0],
    time: candidate.timeline?.stages?.reduce((sum, stage) => sum + stage.ms, 0) || 0
  }));

  const getDecisionBadgeVariant = (decision: string) => {
    switch (decision) {
      case 'advance': return 'default';
      case 'hold': return 'secondary';
      case 'reject': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleSort = (field: keyof Candidate) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Header */}
      <Card className="p-6 shadow-elegant">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {results.candidates.length} candidates
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {Math.round(results.meta.durationMs / 1000)}s runtime
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Brain className="w-4 h-4" />
              {results.meta.agentsUsed.length} agents
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {avgScores.map((score, index) => (
              <div key={score.agent} className="text-center">
                <div className="text-xs text-muted-foreground">{score.agent}</div>
                <div className="font-semibold text-sm">{(score.score * 100).toFixed(0)}%</div>
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${score.score * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 shadow-elegant">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Average Scores by Agent
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={avgScores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agent" />
              <YAxis domain={[0, 1]} />
              <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Score']} />
              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 shadow-elegant">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Composite Profile
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="agent" />
              <PolarRadiusAxis domain={[0, 1]} tick={false} />
              <Radar 
                name="Average" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.3} 
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 shadow-elegant">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Processing Time (Top 10)
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rank" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [`${value}ms`, 'Processing Time']}
                labelFormatter={(label) => `Rank ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="time" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Candidates Table */}
      <Card className="shadow-elegant">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <h4 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Candidates ({filteredCandidates.length})
            </h4>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-64"
                />
              </div>
              
              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('name')}
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    Candidate
                    {sortField === 'name' && (
                      sortDirection === 'desc' ? <SortDesc className="ml-1 w-3 h-3" /> : <SortAsc className="ml-1 w-3 h-3" />
                    )}
                  </Button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('yearsExperience')}
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    Experience
                    {sortField === 'yearsExperience' && (
                      sortDirection === 'desc' ? <SortDesc className="ml-1 w-3 h-3" /> : <SortAsc className="ml-1 w-3 h-3" />
                    )}
                  </Button>
                </th>
                {results.meta.agentsUsed.map(agent => (
                  <th key={agent} className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {agent}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('finalScore')}
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    Final Score
                    {sortField === 'finalScore' && (
                      sortDirection === 'desc' ? <SortDesc className="ml-1 w-3 h-3" /> : <SortAsc className="ml-1 w-3 h-3" />
                    )}
                  </Button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Decision
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {paginatedCandidates.map((candidate, index) => (
                <tr 
                  key={candidate.id} 
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    #{startIndex + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-foreground">{candidate.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {candidate.currentTitle} {candidate.currentCompany && `at ${candidate.currentCompany}`}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {candidate.yearsExperience ? `${candidate.yearsExperience} years` : 'N/A'}
                  </td>
                  {results.meta.agentsUsed.map(agent => (
                    <td key={agent} className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-12 bg-muted rounded-full h-2 mr-2">
                          <div 
                            className="h-2 bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${(candidate.scores?.[agent] || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-foreground">
                          {((candidate.scores?.[agent] || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-muted rounded-full h-2 mr-2">
                        <div 
                          className="h-2 bg-gradient-primary rounded-full transition-all duration-500"
                          style={{ width: `${candidate.finalScore * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {(candidate.finalScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getDecisionBadgeVariant(candidate.decision)}>
                      {candidate.decision}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCandidate(candidate);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredCandidates.length)} of {filteredCandidates.length} candidates
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  );
                })}
                {totalPages > 5 && <span className="text-muted-foreground">...</span>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}