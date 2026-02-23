
import { Repository, ElementType } from './types';

export const INITIAL_REPO: Repository = {
  id: 'repo-demo',
  name: 'ui-forge-demo',
  url: '',
  branch: 'main',
  lastSync: 'Never',
  tokens: [
    { id: 'tok-1', name: 'primary-color', value: '#2563eb', type: 'color' },
    { id: 'tok-2', name: 'radius-default', value: '0.5rem', type: 'radius' },
    { id: 'tok-3', name: 'spacing-base', value: '1rem', type: 'spacing' }
  ],
  components: [
    {
      id: 'comp-1',
      name: 'PrimaryButton',
      tagName: ElementType.BUTTON,
      classes: 'px-6 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-medium rounded-[0.5rem] shadow transition-all flex items-center justify-center gap-2 relative overflow-hidden',
      content: 'Demo Button',
      props: { disabled: false }
    }
  ]
};
