import React, { useState } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { Building2, Plus, Edit3, Trash2, Calendar, X } from 'lucide-react';

export const ChurchesScreen: React.FC = () => {
  const { userRole } = useAuth();
  const { translate } = useApp();
  const { churches, setChurch } = useFilter();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeChurch, setActiveChurch] = useState<any | null>(null);

  const isOwner = userRole === 'owner';

  const handleSaveChurch = async (id: string, displayName: string, activeYearName: string) => {
    const docId = activeChurch ? activeChurch.id : id.trim().toLowerCase().replace(/\s+/g, '_');
    const churchRef = doc(db, 'churches', docId);

    const yearId = activeYearName.trim().toLowerCase().replace(/\s+/g, '_');
    const yearRef = doc(db, 'churches', docId, 'academicYears', yearId);

    // Save church
    await setDoc(churchRef, {
      displayName,
      active: true,
      activeAcademicYearId: yearId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Save initial academic year
    await setDoc(yearRef, {
      displayName: activeYearName,
      active: true,
      startDate: new Date().toISOString().split('T')[0],
    }, { merge: true });

    setChurch(docId);
    setEditModalOpen(false);
    setActiveChurch(null);
  };

  const handleDeleteChurch = async (churchId: string, name: string) => {
    if (!isOwner) return;
    if (window.confirm(`Delete church "${name}"? This will permanently delete the church tenant.`)) {
      const churchRef = doc(db, 'churches', churchId);
      await deleteDoc(churchRef);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('churches_config')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {churches.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Church tenants, timeline milestones, and multi-tenant configurations
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => {
              setActiveChurch(null);
              setEditModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>{translate('add')} Church</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {churches.map((church) => (
          <div
            key={church.id}
            className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    {church.displayName}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-zinc-500">Active Tenant</span>
                  </div>
                </div>
              </div>

              {isOwner && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveChurch(church);
                      setEditModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteChurch(church.id, church.displayName)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>Active Term: <strong className="text-zinc-800 dark:text-zinc-200">{church.data || 'Current'}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {activeChurch ? 'Edit Church' : 'Onboard New Church'}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveChurch(
                  (formData.get('id') as string) || activeChurch?.id || '',
                  formData.get('displayName') as string,
                  (formData.get('academicYear') as string) || 'Academic Year 2026'
                );
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Church Name *</label>
                <input
                  name="displayName"
                  defaultValue={activeChurch?.displayName || ''}
                  required
                  placeholder="e.g. St. Mark Coptic Orthodox Church"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              {!activeChurch && (
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Initial Academic Term *</label>
                  <input
                    name="academicYear"
                    defaultValue="Academic Year 2026-2027"
                    required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30"
                >
                  Save Church
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
