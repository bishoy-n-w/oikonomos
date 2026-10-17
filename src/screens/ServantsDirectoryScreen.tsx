import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import { normalizeDateStr, safeRender } from '../utils/formatters';
import type { Mister, ServiceGroup, ClassDoc } from '../types';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Lock 
} from 'lucide-react';

export const ServantsDirectoryScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    selectedClassId 
  } = useFilter();

  const [servants, setServants] = useState<Mister[]>([]);
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [classes, setClasses] = useState<ClassDoc[]>([]);

  // Header Filter Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editMister, setEditMister] = useState<Mister | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';
  const currentUserEmail = user?.email?.toLowerCase() || '';

  // 1. Listen to misters
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'misters'), (snap) => {
      const items: Mister[] = snap.docs.map((d) => ({
        id: d.id,
        email: d.data().email || d.id,
        displayName: d.data().displayName || d.id,
        active: d.data().active !== false,
        churchRole: d.data().churchRole || 'viewer',
        personalInfo: {
          ...(d.data().personalInfo || {}),
          dob: normalizeDateStr(d.data().personalInfo?.dob),
        },
        createdAt: d.data().createdAt,
        createdBy: d.data().createdBy,
        lastEditAt: d.data().lastEditAt,
        lastEditBy: d.data().lastEditBy,
      }));
      setServants(items);
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 2. Listen to service groups (to resolve adminInGroups & servantInGroups across all groups)
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'serviceGroups'), (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ServiceGroup)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 3. Listen to classes (to resolve servantInClasses based on top selected academic year)
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'classes'), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassDoc)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // Helper: Find groups where mister is Admin (ignoring top groups filter)
  const getAdminGroups = (email: string): string[] => {
    const key = email.toLowerCase();
    return groups
      .filter((g) => {
        if (g.misters && g.misters[key] === 'admin') return true;
        return (g.admins || []).map((e) => e.toLowerCase()).includes(key);
      })
      .map((g) => g.displayName);
  };

  // Helper: Find groups where mister is Servant (ignoring top groups filter)
  const getServantGroups = (email: string): string[] => {
    const key = email.toLowerCase();
    return groups
      .filter((g) => {
        if (g.misters && g.misters[key] === 'servant') return true;
        return (g.servants || []).map((e) => e.toLowerCase()).includes(key);
      })
      .map((g) => g.displayName);
  };

  // Helper: Find classes where mister is Servant in selected academic year (ignoring top groups/classes filter)
  const getServantClasses = (email: string): string[] => {
    const key = email.toLowerCase();
    return classes
      .filter((cls) => {
        const yearData = selectedAcademicYearId ? cls.academicYears?.[selectedAcademicYearId] : Object.values(cls.academicYears || {})[0];
        if (!yearData) return false;
        const misters = (yearData.MistersIds || yearData.servants || []).map((e) => e.toLowerCase());
        return misters.includes(key);
      })
      .map((cls) => {
        const yearData = selectedAcademicYearId ? cls.academicYears?.[selectedAcademicYearId] : Object.values(cls.academicYears || {})[0];
        return yearData?.displayName || yearData?.name || cls.id;
      });
  };

  // Column Filter Matrix configs
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    { key: 'displayName', type: 'text', placeholder: 'Name...' },
    { key: 'churchRole', type: 'select', options: [{ value: 'admin', label: 'Admin' }, { value: 'viewer', label: 'Viewer' }] },
    { key: 'adminGroups', type: 'text', placeholder: 'Admin in...' },
    { key: 'servantGroups', type: 'text', placeholder: 'Servant in...' },
    { key: 'servantClasses', type: 'text', placeholder: 'Classes...' },
    { key: 'email', type: 'text', placeholder: 'Email...' },
    { key: 'phone', type: 'text', placeholder: 'Phone...' },
    { key: 'dob', type: 'text', placeholder: 'DOB...' },
    { key: 'job', type: 'text', placeholder: 'Job...' },
    { key: 'address', type: 'text', placeholder: 'Address...' },
    { key: 'actions', type: 'text', placeholder: '' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Filtered Servants list: filtered by top filters AND Header Filter Matrix
  const filteredServants = servants.filter((m) => {
    const emailKey = m.email.toLowerCase();

    // Top Filter: Service Group Filter
    if (selectedServiceGroupId) {
      const inAdmin = groups.some((g) => g.id === selectedServiceGroupId && ((g.admins || []).includes(m.email) || g.misters?.[emailKey] === 'admin'));
      const inServant = groups.some((g) => g.id === selectedServiceGroupId && ((g.servants || []).includes(m.email) || g.misters?.[emailKey] === 'servant'));
      if (!inAdmin && !inServant) return false;
    }

    // Top Filter: Class Filter
    if (selectedClassId) {
      const targetClass = classes.find((c) => c.id === selectedClassId);
      const yearData = selectedAcademicYearId ? targetClass?.academicYears?.[selectedAcademicYearId] : Object.values(targetClass?.academicYears || {})[0];
      const mistersInClass = (yearData?.MistersIds || yearData?.servants || []).map((e) => e.toLowerCase());
      if (!mistersInClass.includes(emailKey)) return false;
    }

    // Header Filter Matrix
    if (filters.active !== undefined && filters.active !== '') {
      if (String(m.active) !== filters.active) return false;
    }
    if (filters.displayName) {
      if (!m.displayName.toLowerCase().includes(filters.displayName.toLowerCase())) return false;
    }
    if (filters.churchRole) {
      if (m.churchRole !== filters.churchRole) return false;
    }
    if (filters.adminGroups) {
      const ag = getAdminGroups(m.email).join(' ').toLowerCase();
      if (!ag.includes(filters.adminGroups.toLowerCase())) return false;
    }
    if (filters.servantGroups) {
      const sg = getServantGroups(m.email).join(' ').toLowerCase();
      if (!sg.includes(filters.servantGroups.toLowerCase())) return false;
    }
    if (filters.servantClasses) {
      const sc = getServantClasses(m.email).join(' ').toLowerCase();
      if (!sc.includes(filters.servantClasses.toLowerCase())) return false;
    }
    if (filters.email) {
      if (!m.email.toLowerCase().includes(filters.email.toLowerCase())) return false;
    }
    if (filters.phone) {
      if (!m.personalInfo?.phone?.includes(filters.phone)) return false;
    }
    if (filters.dob) {
      if (!m.personalInfo?.dob?.includes(filters.dob)) return false;
    }
    if (filters.job) {
      if (!m.personalInfo?.job?.toLowerCase().includes(filters.job.toLowerCase())) return false;
    }
    if (filters.address) {
      if (!m.personalInfo?.address?.toLowerCase().includes(filters.address.toLowerCase())) return false;
    }

    return true;
  });

  // Save Add/Edit Mister
  const handleSaveMister = async (
    targetMister: Mister | null,
    email: string,
    displayName: string,
    churchRole: 'admin' | 'viewer',
    active: boolean,
    personalInfo: any
  ) => {
    if (!selectedChurchId) return;

    const emailKey = email.toLowerCase().trim();
    const isGoogleEmail = emailKey.includes('@') && (emailKey.endsWith('@gmail.com') || emailKey.includes('.'));
    if (!isGoogleEmail) {
      alert('Please enter a valid Google email address.');
      return;
    }

    const misterRef = doc(db, 'churches', selectedChurchId, 'misters', emailKey);
    const isSelfEditing = emailKey === currentUserEmail;

    const payload: any = {
      email: emailKey,
      displayName,
      personalInfo,
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
      ...(!targetMister && {
        authUid: '',
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      }),
    };

    // Self-service safety guard: non-admins cannot change churchRole or active status on own profile
    if (!isSelfEditing || isAdmin) {
      payload.churchRole = churchRole;
      payload.active = active;
    }

    await setDoc(misterRef, payload, { merge: true });
    setAddModalOpen(false);
    setEditMister(null);
  };

  const handleDeleteMister = async (email: string, name: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm(`Delete servant "${name}"? This action cannot be undone.`)) {
      await deleteDoc(doc(db, 'churches', selectedChurchId, 'misters', email.toLowerCase()));
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
            Servants roster, church roles, service assignments, and personal contacts
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Servant</span>
          </button>
        )}
      </div>

      {/* Details List View (DataTable) with Header Filter Matrix */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-5 py-3.5 text-start w-20">Active</th>
                <th className="px-5 py-3.5 text-start">Full Name</th>
                <th className="px-4 py-3.5 text-start">Church Role</th>
                <th className="px-5 py-3.5 text-start">Admin in Groups</th>
                <th className="px-5 py-3.5 text-start">Servant in Groups</th>
                <th className="px-5 py-3.5 text-start">Servant in Classes</th>
                <th className="px-5 py-3.5 text-start">Google Email</th>
                <th className="px-4 py-3.5 text-start">Phone</th>
                <th className="px-4 py-3.5 text-start">DOB</th>
                <th className="px-4 py-3.5 text-start">Job</th>
                <th className="px-5 py-3.5 text-start">Address</th>
                <th className="px-4 py-3.5 text-end w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Header Filtering Matrix */}
              <HeaderFilterMatrix
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
              />

              {filteredServants.map((mister) => {
                const adminGroups = getAdminGroups(mister.email);
                const servantGroups = getServantGroups(mister.email);
                const servantClasses = getServantClasses(mister.email);
                const isSelf = mister.email.toLowerCase() === currentUserEmail;

                return (
                  <tr
                    key={mister.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 transition"
                  >
                    {/* 1. Active */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        mister.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${mister.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {mister.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* 2. DisplayName */}
                    <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{mister.displayName}</span>
                        {isSelf && (
                          <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-1.5 py-0.2 rounded-full border border-teal-200 dark:border-teal-800">
                            You
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. ChurchRole */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        mister.churchRole === 'admin'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {mister.churchRole}
                      </span>
                    </td>

                    {/* 4. Admin in groups (stacked) */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 max-w-[140px]">
                        {adminGroups.length === 0 && <span className="text-zinc-400 text-[11px]">-</span>}
                        {adminGroups.map((g) => (
                          <span key={g} className="inline-block px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 text-[10px] font-semibold truncate">
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 5. Servant in groups (stacked) */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 max-w-[140px]">
                        {servantGroups.length === 0 && <span className="text-zinc-400 text-[11px]">-</span>}
                        {servantGroups.map((g) => (
                          <span key={g} className="inline-block px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-semibold truncate">
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 6. Servant in classes (stacked) */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 max-w-[140px]">
                        {servantClasses.length === 0 && <span className="text-zinc-400 text-[11px]">-</span>}
                        {servantClasses.map((cls) => (
                          <span key={cls} className="inline-block px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-[10px] font-semibold truncate">
                            {cls}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 7. Email */}
                    <td className="px-5 py-4 whitespace-nowrap font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {mister.email}
                    </td>

                    {/* 8. Phone */}
                    <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px]">
                      {mister.personalInfo?.phone ? (
                        <a href={`tel:${mister.personalInfo.phone}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                          {mister.personalInfo.phone}
                        </a>
                      ) : '-'}
                    </td>

                    {/* 9. DOB */}
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-500">
                      {safeRender(mister.personalInfo?.dob)}
                    </td>

                    {/* 10. Job */}
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {mister.personalInfo?.job || '-'}
                    </td>

                    {/* 11. Address */}
                    <td className="px-5 py-4 whitespace-nowrap text-zinc-500">
                      {mister.personalInfo?.address || '-'}
                    </td>

                    {/* 12. Actions */}
                    <td className="px-4 py-4 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {(isAdmin || isSelf) && (
                          <button
                            onClick={() => setEditMister(mister)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="Edit Servant"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && !isSelf && (
                          <button
                            onClick={() => handleDeleteMister(mister.email, mister.displayName)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Servant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Mister Modal */}
      {(addModalOpen || editMister) && (
        <MisterFormModal
          existingMister={editMister}
          isAdmin={isAdmin}
          isSelf={editMister?.email.toLowerCase() === currentUserEmail}
          onClose={() => {
            setAddModalOpen(false);
            setEditMister(null);
          }}
          onSave={handleSaveMister}
        />
      )}
    </div>
  );
};

// Sub-component: Form modal for Add / Edit Mister
interface MisterFormModalProps {
  existingMister: Mister | null;
  isAdmin: boolean;
  isSelf: boolean;
  onClose: () => void;
  onSave: (
    targetMister: Mister | null,
    email: string,
    displayName: string,
    churchRole: 'admin' | 'viewer',
    active: boolean,
    personalInfo: any
  ) => void;
}

const MisterFormModal: React.FC<MisterFormModalProps> = ({
  existingMister,
  isAdmin,
  isSelf,
  onClose,
  onSave,
}) => {
  const [email, setEmail] = useState(existingMister?.email || '');
  const [displayName, setDisplayName] = useState(existingMister?.displayName || '');
  const [churchRole, setChurchRole] = useState<'admin' | 'viewer'>(existingMister?.churchRole || 'viewer');
  const [active, setActive] = useState(existingMister ? existingMister.active !== false : true);

  // Personal Info state
  const [phone, setPhone] = useState(existingMister?.personalInfo?.phone || '');
  const [gender, setGender] = useState<'male' | 'female'>(existingMister?.personalInfo?.gender || 'male');
  const [dob, setDob] = useState(existingMister?.personalInfo?.dob || '');
  const [job, setJob] = useState(existingMister?.personalInfo?.job || '');
  const [address, setAddress] = useState(existingMister?.personalInfo?.address || '');
  const [notes, setNotes] = useState(existingMister?.personalInfo?.notes || '');

  const canEditRoleAndActive = isAdmin && (!isSelf || existingMister === null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) {
      alert('Email and Full Name are mandatory.');
      return;
    }

    onSave(
      existingMister,
      email,
      displayName,
      churchRole,
      active,
      {
        phone,
        gender,
        dob,
        job,
        address,
        notes,
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {existingMister ? `Edit Servant: ${existingMister.displayName}` : 'Add New Servant'}
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Mandated Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Full Name *</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Google Email *</label>
              <input
                type="email"
                value={email}
                disabled={!!existingMister}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@gmail.com"
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono disabled:opacity-60"
              />
            </div>
          </div>

          {/* Role and Active Status (Locked for non-admin self-service) */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <span>Church Role *</span>
                {!canEditRoleAndActive && <Lock className="w-3 h-3 text-amber-500" />}
              </label>
              <select
                value={churchRole}
                disabled={!canEditRoleAndActive}
                onChange={(e) => setChurchRole(e.target.value as any)}
                className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold disabled:opacity-50"
              >
                <option value="viewer">Viewer / Teacher</option>
                <option value="admin">Church Admin</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <span>Active Status *</span>
                {!canEditRoleAndActive && <Lock className="w-3 h-3 text-amber-500" />}
              </label>
              <select
                value={active ? 'true' : 'false'}
                disabled={!canEditRoleAndActive}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-semibold disabled:opacity-50"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Optional Personal Info */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-xs uppercase text-zinc-400">Personal Information (Optional)</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Phone Number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+201..."
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Job / Profession</label>
                <input
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Home Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, Building, City..."
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer"
            >
              Save Servant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
