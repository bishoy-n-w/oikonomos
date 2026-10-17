import React from 'react';
import { Search, X } from 'lucide-react';

export type FilterType = 'text' | 'select' | 'boolean' | 'number';

export interface ColumnFilterConfig {
  key: string;
  type: FilterType;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

interface HeaderFilterMatrixProps {
  configs: ColumnFilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export const HeaderFilterMatrix: React.FC<HeaderFilterMatrixProps> = ({
  configs,
  values,
  onChange,
}) => {
  return (
    <tr className="bg-zinc-100/70 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
      {configs.map((config) => {
        const value = values[config.key] || '';

        if (config.type === 'boolean') {
          return (
            <th key={config.key} className="p-2 font-normal">
              <select
                value={value}
                onChange={(e) => onChange(config.key, e.target.value)}
                className="w-full text-[11px] font-semibold py-1 px-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </th>
          );
        }

        if (config.type === 'select') {
          return (
            <th key={config.key} className="p-2 font-normal">
              <select
                value={value}
                onChange={(e) => onChange(config.key, e.target.value)}
                className="w-full text-[11px] font-semibold py-1 px-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">All</option>
                {config.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </th>
          );
        }

        if (config.type === 'number') {
          return (
            <th key={config.key} className="p-2 font-normal">
              <input
                type="number"
                value={value}
                onChange={(e) => onChange(config.key, e.target.value)}
                placeholder={config.placeholder || 'Filter...'}
                className="w-full text-[11px] py-1 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </th>
          );
        }

        // Default 'text'
        return (
          <th key={config.key} className="p-2 font-normal">
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-zinc-400 absolute start-2 pointer-events-none" />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(config.key, e.target.value)}
                placeholder={config.placeholder || 'Filter...'}
                className="w-full text-[11px] py-1 ps-6 pe-5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => onChange(config.key, '')}
                  className="absolute end-1.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </th>
        );
      })}
    </tr>
  );
};
