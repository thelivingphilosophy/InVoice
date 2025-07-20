export interface JobData {
  id: string;
  title?: string; // Display title (timestamp-based)
  customer: string;
  jobType: string;
  equipment: string;
  cost: string;
  location?: string;
  additionalNotes?: string;
  dateCreated: string;
  dateCompleted?: string;
  status: 'in-progress' | 'completed' | 'pending' | 'pending_transcription';
  totalSteps: number;
  completedSteps: number;
}

export interface JobWorkflow {
  id: string;
  currentStepIndex: number;
  steps: JobStep[];
  answers: string[];
  dateStarted: string;
  dateLastUpdated: string;
}

export interface JobStep {
  id: string;
  question: string;
  answer?: string;
  completed: boolean;
  audioUri?: string;
}

export const DEFAULT_JOB_STEPS: JobStep[] = [
  {
    id: 'customer',
    question: 'What is the customer name and contact information?',
    completed: false,
  },
  {
    id: 'job-type',
    question: 'What type of job or service are you performing?',
    completed: false,
  },
  {
    id: 'equipment',
    question: 'What equipment, tools, or materials are you using?',
    completed: false,
  },
  {
    id: 'cost',
    question: 'What is the cost estimate or final cost for this job?',
    completed: false,
  },
  {
    id: 'notes',
    question: 'Any additional notes, observations, or next steps?',
    completed: false,
  },
];