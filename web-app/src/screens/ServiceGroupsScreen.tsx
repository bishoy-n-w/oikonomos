import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { ServiceGroup } from '../types';
import { FolderGit2, Plus, Edit3, Trash2, Users, Shield, X } from 'lucide-react';

export const ServiceGroupsScreen: React.FC = () => {
  const { userRole } = useAuth();
  const { translate } = useApp();
  const { selectedChurchId } = useFilter();

  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<ServiceGroup | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  useEffect(() => {
    if (!selectedChurchId) return;

    const groupsRef = collection(db, 'churches', selectedChurchId, 'serviceGroups');
    const unsub = onSnapshot(groupsRef, (snapshot) => {
      const items: ServiceGroup[] = snapshot.docs.map((d) => ({
        id: d.id,
        displayName: d.data().displayName || d.id,
        active: d.data().active !== false,
        admins: d.data().admins || [],
        servants: d.data().servants || [],
      }));
      setGroups(items);
    });

    return () => unsub();
  }, [selectedChurchId]);

  const handleSaveGroup = async (displayName: string) => {
    if (!selectedChurchId) return;

    const docId = activeGroup ? activeGroup.id : displayName.trim().toLowerCase().replace(/\s+/g, '_');
    const groupRef = doc(db, 'churches', selectedChurchId, 'serviceGroups', docId);

    const payload = {
      displayName,
      active: true,
      admins: activeGroup?.admins || [],
      servants: activeGroup?.servants || [],
      updatedAt: new Date().toISOString(),
    };

    await setDoc(groupRef, payload, { merge: true });
    setEditModalOpen(false);
    setActiveGroup(null);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm('Delete this service group? This will remove its active configurations.')) {
      const groupRef = doc(db, 'churches', selectedChurchId, 'serviceGroups', groupId);
      await deleteDoc(groupRef);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('service_groups')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {groups.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Pastoral departments, coordinators, and age brackets
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setActiveGroup(null);
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
        {groups.map((group) => (
          <div
            key={group.id}
            className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                  <FolderGit2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    {group.displayName}
                  </h3>
                  <p className="text-xs text-zinc-400">{group.admins.length} Coordinators</p>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveGroup(group);
                      setEditModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs text-zinc-600 dark:text-zinc-400">
                <Shield className="w-4 h-4 text-purple-600" />
                <span>{group.admins.length} Admins</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs text-zinc-600 dark:text-zinc-400">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{group.servants.length} Servants</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {activeGroup ? 'Edit Service Group' : 'Create Service Group'}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveGroup(formData.get('displayName') as string);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Group Display Name *</label>
                <input
                  name="displayName"
                  defaultValue={activeGroup?.displayName || ''}
                  required
                  placeholder="e.g. Elementary Department"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
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
                  Save Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
