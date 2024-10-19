export interface TaskInput {
  id?: string;
  type: string;
  data: any;
  scheduledIn?: Date;
  scheduledTo?: Date;
  timeConsidered?: number;
  finished?: boolean;
}

export interface Task {
  id: string;
  type: string;
  data: any;
  scheduledIn: Date;
  scheduledTo: Date;
  timeConsidered: number;
  finished: boolean;
}
