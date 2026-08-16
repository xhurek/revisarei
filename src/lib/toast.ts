export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  icon?: 'trophy' | 'book' | 'check' | 'bell' | 'sparkles' | 'info';
  duration?: number;
}

export function showToast(options: ToastOptions | string, description?: string, icon?: ToastOptions['icon']) {
  if (typeof options === 'string') {
    window.dispatchEvent(new CustomEvent('app_toast', {
      detail: {
        id: Math.random().toString(),
        title: options,
        description: description || '',
        icon: icon || 'check',
        duration: 3000
      }
    }));
  } else {
    window.dispatchEvent(new CustomEvent('app_toast', {
      detail: {
        id: options.id || Math.random().toString(),
        title: options.title,
        description: options.description || '',
        icon: options.icon || 'check',
        duration: options.duration || 3000
      }
    }));
  }
}
