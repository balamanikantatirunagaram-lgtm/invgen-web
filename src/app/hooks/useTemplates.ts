import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '../supabase/client';
import { type DynamicTemplate, type BaseLayout } from '../api/types';

export const OFFLINE_TEMPLATES: DynamicTemplate[] = [
  { id: 'classic', name: 'Classic', base_layout: 'classic', is_pro: false, style_config: {} },
  { id: 'modern', name: 'Modern', base_layout: 'modern', is_pro: false, style_config: {} }
];

export function useTemplates() {
  return useQuery({
    queryKey: ['invoice_templates'],
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return OFFLINE_TEMPLATES;

      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .eq('is_active', true);

      if (error || !data) {
        console.error('Failed to load online templates', error);
        return OFFLINE_TEMPLATES;
      }

      const onlineTemplates: DynamicTemplate[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        base_layout: (row.base_layout as BaseLayout) || 'classic',
        is_pro: row.is_pro || false,
        style_config: row.style_config || {}
      }));

      return [...OFFLINE_TEMPLATES, ...onlineTemplates];
    },
    staleTime: 1000 * 15, // 5 minutes
    placeholderData: OFFLINE_TEMPLATES
  });
}
