import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { ClassDoc } from '../types';
import { GraduationCap, Plus, Edit3, Trash2, Users, Baby, X } from 'lucide-react';

export const ClassesScreen: React.FC = () => {
  const { userRole } = useAuth();
  const { translate } = useApp();
  const { selectedChurchId, selectedAcademicYearId, serviceGroups } = useFilter();

  const [classList, setClassList] = useState<ClassDoc[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassDoc | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  useEffect(() => {
    if (!selectedChurchId) return;

    const classesRef = collection(db, 'churches', selectedChurchId, 'classes');
    const unsub = onSnapshot(classesRef, (snapshot) => {
      const items: ClassDoc[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as ClassDoc));
      setClassList(items);
    });

    return () => unsub();
  }, [selectedChurchId]);

  const handleSaveClass = async (id: string, name: string, serviceGroupId: string) => {
    if (!selectedChurchId || !selectedAcademicYearId) return;

    const docId = activeClass ? activeClass.id : id.trim().toLowerCase().replace(/\s+/g, '_');
    const classRef = doc(db, 'churches', selectedChurchId, 'classes', docId);

    const existingYears = activeClass?.academicYears || {};
    const payload = {
      active: true,
      serviceGroupId,
      academicYears: {
        ...existingYears,
        [selectedAcademicYearId]: {
          name,
          kids: existingYears[selectedAcademicYearId]?.kids || [],
          servants: existingYears[selectedAcademicYearId]?.servants || [],
        },
      },
      updatedAt: new Date().toISOString(),
    };

    await setDoc(classRef, payload, { merge: true });
    setEditModalOpen(false);
    setActiveClass(null);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm('Delete this class? This will remove its active configurations.')) {
      const classRef = doc(db, 'churches', selectedChurchId, 'classes', classId);
      await deleteDoc(classRef);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('classes')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {classList.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Classrooms, grade levels, and student-teacher allocations
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setActiveClass(null);
              setEditModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>{translate('add')}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classList.map((cls) => {
          const yearData = selectedAcademicYearId ? cls.academicYears?.[selectedAcademicYearId] : Object.values(cls.academicYears || {})[0];
          const className = yearData?.name || cls.id;
          const kidsCount = yearData?.kids?.length || 0;
          const servantsCount = yearData?.servants?.length || 0;
          const groupName = serviceGroups.find((g) => g.id === cls.serviceGroupId)?.displayName || cls.serviceGroupId;

          return (
            <div
              key={cls.id}
              className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                      {className}
                    </h3>
                    <p className="text-xs text-zinc-400">{groupName}</p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setActiveClass(cls);
                        setEditModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClass(cls.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs text-zinc-600 dark:text-zinc-400">
                  <Baby className="w-4 h-4 text-teal-600" />
                  <span>{kidsCount} Kids</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs text-zinc-600 dark:text-zinc-400">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>{servantsCount} Servants</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {activeClass ? 'Edit Class' : 'Create Class'}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveClass(
                  (formData.get('id') as string) || (activeClass?.id || ''),
                  formData.get('name') as string,
                  formData.get('serviceGroupId') as string
                );
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Class Name *</label>
                <input
                  name="name"
                  defaultValue={activeClass?.academicYears?.[selectedAcademicYearId || '']?.name || ''}
                  required
                  placeholder="e.g. Grade 4 St. George"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Service Group *</label>
                <select
                  name="serviceGroupId"
                  defaultValue={activeClass?.serviceGroupId || serviceGroups[0]?.id || ''}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                >
                  {serviceGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.displayName}
                    </option>
                  ))}
                </select>
              </div>

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
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
