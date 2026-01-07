export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  order: number;
}

export interface ProjectPlan {
  id: string;
  title: string;
  description?: string;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
}

