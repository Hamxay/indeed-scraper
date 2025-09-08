import { transformApiResponse, AgentKey, type Candidate, type EvaluateResponse } from '../store/evaluationStore';

// Mock data arrays
const mockNames = [
  'Sarah Chen', 'Marcus Johnson', 'Elena Rodriguez', 'David Kim', 'Priya Patel',
  'Alex Thompson', 'Maya Singh', 'Jordan Davis', 'Sophia Wang', 'Ryan Miller',
  'Aisha Ahmed', 'Carlos Martinez', 'Emma Wilson', 'Noah Brown', 'Zara Al-Hassan',
  'Luis García', 'Chloe Taylor', 'Kevin O\'Connor', 'Raj Sharma', 'Olivia Lee'
];

const mockTitles = [
  'Senior Software Engineer', 'Product Manager', 'Data Scientist', 'UX Designer',
  'Engineering Manager', 'Full Stack Developer', 'DevOps Engineer', 'Technical Lead',
  'Backend Developer', 'Frontend Developer', 'Machine Learning Engineer', 'QA Engineer',
  'Systems Architect', 'Cloud Engineer', 'Security Engineer', 'Mobile Developer'
];

const mockCompanies = [
  'TechCorp', 'InnovateLabs', 'DataFlow Inc', 'CloudScale', 'NexGen Systems',
  'DigitalEdge', 'SmartWare', 'TechVision', 'CodeCraft', 'DataDriven Co',
  'CloudFirst', 'AgileWorks', 'TechNova', 'IntelliSoft', 'ByteForge'
];

const mockCities = ['New York', 'San Francisco', 'Seattle', 'Austin', 'Chicago', 'Boston', 'Denver', 'Atlanta'];
const mockStates = ['NY', 'CA', 'WA', 'TX', 'IL', 'MA', 'CO', 'GA'];

const skillsList = [
  'Python', 'JavaScript', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes', 'Machine Learning',
  'TensorFlow', 'PyTorch', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'Spark', 'Hadoop',
  'Git', 'CI/CD', 'Jenkins', 'Terraform', 'Ansible', 'Linux', 'Bash', 'PowerBI', 'Tableau'
];

function generateRandomSkills(): string {
  const numSkills = Math.floor(Math.random() * 15 + 10);
  const selectedSkills = [...skillsList].sort(() => 0.5 - Math.random()).slice(0, numSkills);
  return selectedSkills.join('; ');
}

function generateEducationSummary(): string {
  const degrees = ['Bachelor of Science', 'Master of Science', 'Bachelor of Engineering'];
  const universities = ['Stanford University', 'MIT', 'University of California', 'Carnegie Mellon'];
  const degree = degrees[Math.floor(Math.random() * degrees.length)];
  const university = universities[Math.floor(Math.random() * universities.length)];
  return `${degree} | ${university}`;
}

function generateExperienceJson(): string {
  const experiences = [];
  const currentYear = new Date().getFullYear();
  let currentDate = currentYear;
  
  for (let i = 0; i < Math.floor(Math.random() * 3 + 2); i++) {
    const startYear = currentDate - Math.floor(Math.random() * 4 + 1);
    const endYear = i === 0 ? 'current' : currentDate;
    const duration = i === 0 ? (currentYear - startYear) * 12 : (currentDate - startYear) * 12;
    
    experiences.push({
      title: mockTitles[Math.floor(Math.random() * mockTitles.length)],
      company: mockCompanies[Math.floor(Math.random() * mockCompanies.length)],
      from: `${startYear}-${String(Math.floor(Math.random() * 12 + 1)).padStart(2, '0')}`,
      to: endYear === 'current' ? 'current' : `${endYear}-${String(Math.floor(Math.random() * 12 + 1)).padStart(2, '0')}`,
      duration_months: duration
    });
    
    currentDate = startYear;
  }
  
  return JSON.stringify(experiences);
}

function generateFeedback(evaluator: string, score: number): string {
  const feedbackTemplates = {
    experience: [
      `Score: ${score}\nFeedback: The candidate demonstrates strong experience with ${Math.floor(score/10)} years in relevant roles. Their career progression shows consistent growth and increasing responsibilities. Some areas for development include specific project outcomes and quantifiable impacts.`,
      `Score: ${score}\nFeedback: Excellent background in the field with proven track record. The candidate has worked across multiple organizations showing adaptability. Leadership experience is evident from their role progression. Minor gaps in recent technology adoption may need exploration.`
    ],
    skills: [
      `Score: ${score}\nFeedback: Strong technical competencies across relevant technologies. The candidate shows proficiency in key areas required for the role. Some gaps in emerging technologies but overall well-equipped. Practical implementation experience is solid.`,
      `Score: ${score}\nFeedback: Comprehensive skill set with deep expertise in core technologies. The breadth of experience across different tech stacks is impressive. Minor areas for improvement in cloud-native architectures but generally strong profile.`
    ],
    culture: [
      `Score: ${score}\nFeedback: Good cultural alignment with demonstrated collaboration and communication skills. The candidate shows values that align with team-oriented environments. Some areas for exploration around feedback handling and conflict resolution but overall positive indicators.`,
      `Score: ${score}\nFeedback: Strong cultural fit with evidence of teamwork and leadership qualities. Communication skills appear solid based on their background. Further probing needed on adaptability and change management but good foundational alignment.`
    ]
  };
  
  const templates = feedbackTemplates[evaluator as keyof typeof feedbackTemplates];
  return templates[Math.floor(Math.random() * templates.length)];
}

const mockService = {
  evaluateCandidates: async (request: {
    input: string;
    max_candidates: number;
    experience_evaluator: boolean;
    skills_evaluator: boolean;
    culture_evaluator: boolean;
  }) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 500));
    
    const evaluatorsUsed = [];
    if (request.experience_evaluator) evaluatorsUsed.push('experience');
    if (request.skills_evaluator) evaluatorsUsed.push('skills');
    if (request.culture_evaluator) evaluatorsUsed.push('culture');
    
    const topCandidates = Array.from({ length: request.max_candidates }, (_, i) => {
      const candidate = {
        name: mockNames[i % mockNames.length],
        locale: 'en_US',
        location: `${mockCities[Math.floor(Math.random() * mockCities.length)]}, ${mockStates[Math.floor(Math.random() * mockStates.length)]}`,
        resume_type: Math.random() > 0.5 ? 'PARSED' : 'INDEED_RESUME',
        free_to_contact: Math.random() > 0.3,
        skills: generateRandomSkills(),
        education_summary: generateEducationSummary(),
        highest_degree: Math.random() > 0.3 ? 'Bachelor of Science' : 'Master of Science',
        experiences_json: generateExperienceJson(),
        current_title: mockTitles[Math.floor(Math.random() * mockTitles.length)],
        total_experience_years: Math.random() * 10 + 3
      };

      const scores: Record<string, number> = {};
      evaluatorsUsed.forEach(evaluator => {
        scores[evaluator] = Math.floor(Math.random() * 20 + 75); // 75-95
      });

      const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length;

      const feedback: Record<string, string> = {};
      evaluatorsUsed.forEach(evaluator => {
        feedback[evaluator] = generateFeedback(evaluator, scores[evaluator]);
      });

      return {
        candidate,
        scores,
        feedback,
        overall_score: overallScore
      };
    });

    // Sort by overall score descending
    topCandidates.sort((a, b) => b.overall_score - a.overall_score);

    return {
      total_candidates_evaluated: request.max_candidates + Math.floor(Math.random() * 10 + 5),
      top_candidates_count: request.max_candidates,
      evaluators_used: evaluatorsUsed,
      top_candidates: topCandidates
    };
  }
};

export async function mockEvaluate(
  jobDescription: string,
  agents: AgentKey[],
  candidateCount: number
) {
  return mockService.evaluateCandidates({
    input: jobDescription,
    max_candidates: candidateCount,
    experience_evaluator: agents.includes('experience'),
    skills_evaluator: agents.includes('skills'),
    culture_evaluator: agents.includes('culture')
  });
}

export async function mockFetchJobDescription(url: string): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 300));
  
  return `Senior Software Engineer - Full Stack Development

We are seeking a talented Senior Software Engineer to join our growing team. You will be responsible for designing, developing, and maintaining scalable web applications using modern technologies.

Key Responsibilities:
• Lead development of complex features and systems
• Mentor junior developers and conduct code reviews  
• Collaborate with product managers and designers
• Ensure high code quality and best practices
• Participate in architectural decisions

Required Skills:
• 5+ years of software development experience
• Strong proficiency in JavaScript/TypeScript, React, Node.js
• Experience with cloud platforms (AWS, GCP, or Azure)
• Knowledge of database design and optimization
• Excellent problem-solving and communication skills

Preferred Qualifications:
• Experience with microservices architecture
• Knowledge of DevOps practices and CI/CD
• Previous experience in a senior or lead role
• Bachelor's degree in Computer Science or related field

We offer competitive compensation, excellent benefits, and opportunities for professional growth in a collaborative environment.`;
}