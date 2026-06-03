import { BaseBoxShapeTool } from 'tldraw';

/**
 * Ferramenta customizada do Canvas (TaskCardTool).
 * Herda o comportamento padrão de criação de formas baseadas em caixa (Box Shapes),
 * mapeando automaticamente as interações do cursor para a criação de formas 'task-card'.
 */
export class TaskCardTool extends BaseBoxShapeTool {
  static override id = 'task-card';
  override shapeType = 'task-card' as const;
}
