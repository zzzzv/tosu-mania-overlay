export type StatusPanelType = 'info' | 'warning' | 'error';

const STYLE_ID = 'shared-status-panel-style';

function ensureStatusPanelStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .shared-status-panel {
      box-sizing: border-box;
      display: none;
      width: 100%;
      padding: 12px 14px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 10px;
      background: rgba(8, 24, 46, 0.78);
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      color: rgba(244, 248, 255, 0.96);
      font-size: 15px;
      font-weight: 600;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    .shared-status-panel.is-visible {
      display: block;
    }

    .shared-status-panel[data-status-panel-type='info'] {
      border-color: rgba(121, 242, 231, 0.24);
      background: rgba(10, 38, 58, 0.74);
      color: rgba(233, 251, 255, 0.96);
    }

    .shared-status-panel[data-status-panel-type='warning'] {
      border-color: rgba(255, 210, 138, 0.28);
      background: rgba(64, 40, 10, 0.74);
      color: rgba(255, 245, 214, 0.97);
    }

    .shared-status-panel[data-status-panel-type='error'] {
      border-color: rgba(255, 170, 170, 0.26);
      background: rgba(56, 22, 28, 0.7);
      color: rgba(255, 237, 240, 0.96);
    }
  `;

  document.head.appendChild(style);
}

export class StatusPanel {
  readonly element: HTMLElement;
  private controlledElement: HTMLElement | null = null;

  constructor(element: HTMLElement) {
    ensureStatusPanelStyles();
    this.element = element;
    this.element.classList.add('shared-status-panel');
    this.clear();
  }

  bindContent(element: HTMLElement) {
    this.controlledElement = element;
    this.syncVisibility();
  }

  set(message: string | null | undefined, type: StatusPanelType = 'info') {
    const content = message?.trim() ?? '';
    this.element.dataset.statusPanelType = type;
    this.element.textContent = content;
    this.element.classList.toggle('is-visible', content.length > 0);
    this.syncVisibility();
  }

  info(message: string | null | undefined) {
    this.set(message, 'info');
  }

  warning(message: string | null | undefined) {
    this.set(message, 'warning');
  }

  error(message: string | null | undefined) {
    this.set(message, 'error');
  }

  clear() {
    this.element.dataset.statusPanelType = 'info';
    this.element.textContent = '';
    this.element.classList.remove('is-visible');
    this.syncVisibility();
  }

  private syncVisibility() {
    if (!this.controlledElement) {
      return;
    }

    this.controlledElement.hidden = this.element.classList.contains('is-visible');
  }
}