export interface SimulationResult {
  stdout: string;
  stderr: string;
  success: boolean;
  plotData?: any[];
}

export interface SpiceFile {
  id: string;
  name: string;
  content: string;
}
