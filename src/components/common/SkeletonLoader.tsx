import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({
  rows = 6,
}) => {
  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs p-4 overflow-hidden animate-pulse">
      {/* Table Header Placeholder */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 gap-4 mb-3">
        <div className="w-32 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="flex items-center gap-2">
          <div className="w-20 h-7 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
          <div className="w-20 h-7 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* Row Shimmers */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-4 py-2 border-b border-zinc-50 dark:border-zinc-800/40">
            {/* Avatar skeleton */}
            <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            
            {/* Column text skeletons */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 items-center">
              <div className="w-3/4 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="w-1/2 h-3.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-md hidden sm:block" />
              <div className="w-2/3 h-3.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-md hidden md:block" />
              <div className="w-16 h-5 bg-zinc-100 dark:bg-zinc-800/80 rounded-full hidden sm:block" />
              <div className="w-12 h-3.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-md ms-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="w-2/3 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="w-1/2 h-3 bg-zinc-100 dark:bg-zinc-800/80 rounded-md" />
            </div>
          </div>
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="w-20 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
            <div className="w-16 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero Banner Skeleton */}
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="w-48 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          <div className="w-64 h-3.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-md" />
        </div>
        <div className="w-32 h-9 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-24 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="w-16 h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
};
