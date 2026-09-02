export type CanvasTextComponent = {
  type: 'text';
  text: string;
  style: 'header' | 'paragraph' | 'muted';
};

export type CanvasDividerComponent = {
  type: 'divider';
};

export type CanvasListItem = {
  type: 'item';
  id?: string;
  title: string;
  subtitle?: string;
  action?: {
    type: 'url' | 'submit';
    url?: string;
    payload?: Record<string, unknown>;
  };
};

export type CanvasListComponent = {
  type: 'list';
  items: CanvasListItem[];
};

export type CanvasButtonComponent = {
  type: 'button';
  id?: string;
  label: string;
  style: 'primary' | 'secondary' | 'link';
  action: {
    type: 'url' | 'submit';
    url?: string;
    payload?: Record<string, unknown>;
  };
};

export type CanvasInputComponent = {
  type: 'input';
  id: string;
  label?: string;
  placeholder?: string;
  value?: string;
  save_state?: 'unsaved' | 'saved' | 'failed';
  disabled?: boolean;
  action?: {
    type: 'submit' | 'url';
    url?: string;
  };
};

export type CanvasComponent =
  | CanvasTextComponent
  | CanvasDividerComponent
  | CanvasListComponent
  | CanvasButtonComponent
  | CanvasInputComponent;

export type CanvasContent = {
  components: CanvasComponent[];
};

export type CanvasResponse = {
  canvas: {
    content: CanvasContent;
  };
};
