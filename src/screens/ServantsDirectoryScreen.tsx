import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { Mister } from '../types';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Phone, 
  Briefcase, 
  Lock, 
  X 
} from 'lucide-react';

export const ServantsDirectoryScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { selectedChurchId } = useFilter();

  const [servants, setServants] = useState<Mister[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeMister, setActiveMister] = useState<Mister | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';
  const currentUserEmail = user?.email?.toLowerCase() || '';

  useEffect(() => {
    if (!selectedChurchId) return;

    const mistersRef = collection(db, 'churches', selectedChurchId, 'misters');
    const unsub = onSnapshot(mistersRef, (snapshot) => {
      const items: Mister[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          email: data.email || docSnap.id,
          displayName: data.displayName || docSnap.id,
          active: data.active !== false,
          churchRole: data.churchRole || 'viewer',
          personalInfo: data.personalInfo || {},
          adminInGroups: data.adminInGroups || [],
          servantInGroups: data.servantInGroups || [],
          servantInClasses: data.servantInClasses || [],
        };
      });
      setServants(items);
    });

    return () => unsub();
  }, [selectedChurchId]);

  const filteredServants = servants.filter((s) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.personalInfo?.phone?.includes(q) ||
        s.personalInfo?.job?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSaveMister = async (payload: Partial<Mister>) => {
    if (!selectedChurchId) return;
    const emailKey = (activeMister?.email || payload.email || '').toLowerCase().trim();
    if (!emailKey) return;

    const misterRef = doc(db, 'churches', selectedChurchId, 'misters', emailKey);

    // Self-service safety guard: if not admin, cannot change role or active
    const isSelfEditing = activeMister?.email.toLowerCase() === currentUserEmail;
    const safePayload: any = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    if (isSelfEditing && !isAdmin) {
      delete safePayload.churchRole;
      delete safePayload.active;
    }

    await setDoc(misterRef, safePayload, { merge: true });
    setEditModalOpen(false);
    setActiveMister(null);
  };

  const handleDeleteMister = async (misterId: string, name: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm(`Are you sure you want to remove servant "${name}"?`)) {
      const misterRef = doc(db, 'churches', selectedChurchId, 'misters', misterId);
      await deleteDoc(misterRef);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('servants')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredServants.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Active church teachers, group leaders, and administration roster
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setActiveMister(null);
              setEditModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>{translate('add')}</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`${translate('search')} ${translate('servants')}...`}
          className="w-full text-sm ps-10 pe-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
        />
      </div>

      {/* Responsive List / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServants.map((mister) => {
          const isSelf = mister.email.toLowerCase() === currentUserEmail;

          return (
            <div
              key={mister.id}
              className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 relative hover:shadow-md transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shadow-xs">
                    {mister.displayName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>{mister.displayName}</span>
                      {isSelf && (
                        <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 rounded-full border border-teal-200 dark:border-teal-800">
                          You
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate max-w-[160px] font-mono">
                      {mister.email}
                    </p>
                  </div>
                </div>

                {/* Edit / Delete */}
                <div className="flex items-center gap-1">
                  {(isAdmin || isSelf) && (
                    <button
                      onClick={() => {
                        setActiveMister(mister);
                        setEditModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && !isSelf && (
                    <button
                      onClick={() => handleDeleteMister(mister.id, mister.displayName)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status and Role Chips */}
              <div className="flex items-center gap-2 pt-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  mister.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${mister.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  {mister.active ? translate('active') : translate('inactive')}
                </span>

                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  mister.churchRole === 'admin'
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {mister.churchRole}
                </span>
              </div>

              {/* Personal Info fields */}
              <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                {mister.personalInfo?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <a href={`tel:${mister.personalInfo.phone}`} className="text-teal-600 dark:text-teal-400 font-mono hover:underline">
                      {mister.personalInfo.phone}
                    </a>
                  </div>
                )}
                {mister.personalInfo?.job && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{mister.personalInfo.job}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Servant Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {activeMister ? 'Edit Servant Profile' : 'Add Servant'}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveMister({
                  email: (formData.get('email') as string) || activeMister?.email,
                  displayName: formData.get('displayName') as string,
                  churchRole: (formData.get('churchRole') as any) || activeMister?.churchRole || 'viewer',
                  active: formData.get('active') === 'true',
                  personalInfo: {
                    phone: formData.get('phone') as string,
                    job: formData.get('job') as string,
                    address: formData.get('address') as string,
                  },
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Full Name *</label>
                <input
                  name="displayName"
                  defaultValue={activeMister?.displayName || ''}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Google Email *</label>
                <input
                  name="email"
                  type="email"
                  disabled={!!activeMister}
                  defaultValue={activeMister?.email || ''}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm disabled:opacity-60 font-mono"
                />
              </div>

              {/* Role & Active Toggle (Locked for self-service non-admins) */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                    <span>Church Role</span>
                    {!isAdmin && <Lock className="w-3 h-3 text-amber-500" />}
                  </label>
                  <select
                    name="churchRole"
                    disabled={!isAdmin}
                    defaultValue={activeMister?.churchRole || 'viewer'}
                    className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-50"
                  >
                    <option value="viewer">Viewer / Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                    <span>Active Status</span>
                    {!isAdmin && <Lock className="w-3 h-3 text-amber-500" />}
                  </label>
                  <select
                    name="active"
                    disabled={!isAdmin}
                    defaultValue={activeMister?.active !== false ? 'true' : 'false'}
                    className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-50"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Mobile Number</label>
                <input
                  name="phone"
                  placeholder="+201..."
                  defaultValue={activeMister?.personalInfo?.phone || ''}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Profession / Job</label>
                <input
                  name="job"
                  defaultValue={activeMister?.personalInfo?.job || ''}
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
                  Save Servant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
