import React, { useState } from 'react';
import { doc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useModalEscape } from '../../utils/useModalEscape';
import type { ClassDoc } from '../../types';
import { Users, X, Check, RefreshCw } from 'lucide-react';

interface BulkAssignmentModalProps {
  churchId: string;
  selectedKidIds: string[];
  academicYears: Array<{ id: string; displayName: string }>;
  serviceGroups: Array<{ id: string; displayName: string }>;
  classes: ClassDoc[];
  defaultYearId: string;
  defaultGroupId: string;
  defaultClassId: string;
  onClose: () => void;
  onSuccess: (updatedCount: number) => void;
}

export const BulkAssignmentModal: React.FC<BulkAssignmentModalProps> = ({
  churchId,
  selectedKidIds,
  academicYears,
  serviceGroups,
  classes,
  defaultYearId,
  defaultGroupId,
  defaultClassId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { translate } = useApp();
  useModalEscape(onClose, true);

  const [targetYearId, setTargetYearId] = useState(defaultYearId || academicYears[0]?.id || '');
  const [targetGroupId, setTargetGroupId] = useState(defaultGroupId || serviceGroups[0]?.id || '');
  const [targetClassId, setTargetClassId] = useState(defaultClassId || '');
  const [updating, setUpdating] = useState(false);

  // Filter classes matching targetGroupId
  const availableClasses = classes.filter((c) => {
    const yearData = targetYearId ? c.academicYears?.[targetYearId] : Object.values(c.academicYears || {})[0];
    return (yearData?.serviceGroupId || c.serviceGroupId) === targetGroupId;
  });

  const handleApplyBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetYearId || !targetGroupId || !targetClassId) {
      alert('Please select an Academic Year, Service Group, and Class.');
      return;
    }

    setUpdating(true);
    try {
      const batchSize = 400;
      for (let i = 0; i < selectedKidIds.length; i += batchSize) {
        const chunk = selectedKidIds.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach((kidId) => {
          const kidRef = doc(db, 'churches', churchId, 'kids', kidId);
          batch.update(kidRef, {
            'activeAssignment.academicYearId': targetYearId,
            'activeAssignment.serviceGroupId': targetGroupId,
            'activeAssignment.classId': targetClassId,
            // Keep top-level flattened helpers synchronized
            academicYearId: targetYearId,
            serviceGroupId: targetGroupId,
            classId: targetClassId,
            lastEditAt: new Date().toISOString(),
            lastEditBy: user?.email || 'admin',
          });
        });

        await batch.commit();
      }

      // Sync target class document with reassigned kids
      try {
        const classRef = doc(db, 'churches', churchId, 'classes', targetClassId);
        const classSnap = await getDoc(classRef);
        if (classSnap.exists()) {
          const classData = classSnap.data();
          const yearsMap = classData.academicYears || {};
          const yearData = yearsMap[targetYearId] || {};
          const existingKidIds: string[] = yearData.KidIds || yearData.kids || [];
          const mergedKidIds = Array.from(new Set([...existingKidIds, ...selectedKidIds]));

          await setDoc(classRef, {
            academicYears: {
              ...yearsMap,
              [targetYearId]: {
                ...yearData,
                KidIds: mergedKidIds,
                kids: mergedKidIds,
              },
            },
            lastEditAt: new Date().toISOString(),
            lastEditBy: user?.email || 'admin',
          }, { merge: true });
        }
      } catch (classSyncErr) {
        console.warn('Could not update target class document during bulk assignment:', classSyncErr);
      }

      // Remove reassigned kids from their previous classes for this year
      try {
        const otherClasses = classes.filter((c) => c.id !== targetClassId);
        await Promise.all(
          otherClasses.map(async (cls) => {
            const classRef = doc(db, 'churches', churchId, 'classes', cls.id);
            const classSnap = await getDoc(classRef);
            if (classSnap.exists()) {
              const classData = classSnap.data();
              const yearsMap = { ...(classData.academicYears || {}) };
              let changed = false;

              Object.keys(yearsMap).forEach((yId) => {
                const yData = yearsMap[yId] || {};
                const curIds: string[] = yData.KidIds || yData.kids || [];
                const filtered = curIds.filter((id) => !selectedKidIds.includes(id));
                if (filtered.length !== curIds.length) {
                  yearsMap[yId] = { ...yData, KidIds: filtered, kids: filtered };
                  changed = true;
                }
              });

              if (changed) {
                await setDoc(classRef, {
                  academicYears: yearsMap,
                  lastEditAt: new Date().toISOString(),
                  lastEditBy: user?.email || 'admin',
                }, { merge: true });
              }
            }
          })
        );
      } catch (otherClassesErr) {
        console.warn('Could not clean up prior classes during bulk reassignment:', otherClassesErr);
      }

      onSuccess(selectedKidIds.length);
    } catch (err) {
      console.error('Bulk reassignment failed:', err);
      alert('Failed to update assignments for selected students.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Bulk Change Assignment
              </h3>
              <p className="text-[11px] text-zinc-400">
                Reassigning <strong className="text-purple-600 dark:text-purple-400">{selectedKidIds.length}</strong> selected students
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={updating} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleApplyBulk} className="space-y-4 text-xs">
          <fieldset disabled={updating} className="space-y-4">
          {/* Target Year */}
          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Target Academic Year *</label>
            <select
              value={targetYearId}
              onChange={(e) => setTargetYearId(e.target.value)}
              required
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.displayName}</option>
              ))}
            </select>
          </div>

          {/* Target Service Group */}
          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Target Service Group *</label>
            <select
              value={targetGroupId}
              onChange={(e) => {
                setTargetGroupId(e.target.value);
                setTargetClassId('');
              }}
              required
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
            >
              {serviceGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.displayName}</option>
              ))}
            </select>
          </div>

          {/* Target Class */}
          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Target Class *</label>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              required
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
            >
              <option value="" disabled>Select Classroom</option>
              {availableClasses.map((cls) => {
                const yearData = targetYearId ? cls.academicYears?.[targetYearId] : Object.values(cls.academicYears || {})[0];
                return (
                  <option key={cls.id} value={cls.id}>
                    {yearData?.displayName || yearData?.name || cls.id}
                  </option>
                );
              })}
            </select>
            {availableClasses.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">No classes found in this service group.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={updating}
              className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
            >
              {translate('cancel')}
            </button>
            <button
              type="submit"
              disabled={updating || !targetClassId}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-98 transition shadow-md shadow-purple-600/30 disabled:opacity-50 cursor-pointer"
            >
              {updating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{updating ? translate('saving') : 'Apply Reassignment'}</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
