import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import type { ClassDoc, Church, Mister, Kid, ClassYearData } from '../types';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Search, 
  Check, 
  Users, 
  Baby 
} from 'lucide-react';

export const ClassesScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { 
    selectedChurchId, 
    selectedAcademicYearId, 
    selectedServiceGroupId, 
    serviceGroups, 
    academicYears 
  } = useFilter();

  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);
  const [allMisters, setAllMisters] = useState<Mister[]>([]);
  const [allKids, setAllKids] = useState<Kid[]>([]);

  // Header Filter Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassDoc | null>(null);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  // 1. Listen to Church (for grades taxonomy)
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(doc(db, 'churches', selectedChurchId), (snap) => {
      if (snap.exists()) {
        setCurrentChurch({ id: snap.id, ...snap.data() } as Church);
      }
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 2. Listen to Misters
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'misters'), (snap) => {
      setAllMisters(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Mister)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 3. Listen to Kids in Church
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'kids'), (snap) => {
      setAllKids(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Kid)));
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 4. Listen to Classes
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'classes'), (snap) => {
      const items: ClassDoc[] = snap.docs.map((d) => ({
        id: d.id,
        active: d.data().active !== false,
        academicYears: d.data().academicYears || {},
        serviceGroupId: d.data().serviceGroupId,
        createdAt: d.data().createdAt,
        createdBy: d.data().createdBy,
      }));
      setClasses(items);
    });
    return () => unsub();
  }, [selectedChurchId]);

  // Column Filter Matrix configs
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    { key: 'className', type: 'text', placeholder: 'Filter Class...' },
    { key: 'groupName', type: 'text', placeholder: 'Filter Group...' },
    { key: 'gradeName', type: 'text', placeholder: 'Filter Grade...' },
    { key: 'kidsCount', type: 'number', placeholder: 'Min kids...' },
    { key: 'mistersCount', type: 'number', placeholder: 'Min servants...' },
    { key: 'actions', type: 'text', placeholder: '' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Helper to extract year data based on selectedAcademicYearId
  const getYearData = (cls: ClassDoc): ClassYearData | null => {
    if (!selectedAcademicYearId) return Object.values(cls.academicYears)[0] || null;
    return cls.academicYears[selectedAcademicYearId] || null;
  };

  // Filtered classes: respects Top Filters (Church, AcademicYear, Service Group) AND Header Filter Matrix!
  const filteredClasses = classes.filter((cls) => {
    const yearData = getYearData(cls);
    if (!yearData) return false;

    // Top filter: Service Group filter
    if (selectedServiceGroupId && yearData.serviceGroupId !== selectedServiceGroupId) {
      return false;
    }

    // Header Filter Matrix
    if (filters.active !== undefined && filters.active !== '') {
      if (String(cls.active) !== filters.active) return false;
    }
    if (filters.className) {
      const name = yearData.displayName || yearData.name || '';
      if (!name.toLowerCase().includes(filters.className.toLowerCase())) return false;
    }
    if (filters.groupName) {
      const gName = serviceGroups.find((g) => g.id === yearData.serviceGroupId)?.displayName || yearData.serviceGroupId;
      if (!gName.toLowerCase().includes(filters.groupName.toLowerCase())) return false;
    }
    if (filters.gradeName) {
      const grade = currentChurch?.grades?.[yearData.gradeId || '']?.name || yearData.gradeId || '';
      if (!grade.toLowerCase().includes(filters.gradeName.toLowerCase())) return false;
    }
    if (filters.kidsCount) {
      const count = (yearData.KidIds || yearData.kids || []).length;
      if (count < parseInt(filters.kidsCount, 10)) return false;
    }
    if (filters.mistersCount) {
      const count = (yearData.MistersIds || yearData.servants || []).length;
      if (count < parseInt(filters.mistersCount, 10)) return false;
    }
    return true;
  });

  // Save Add/Edit Class
  const handleSaveClass = async (
    classId: string | null,
    academicYearId: string,
    displayName: string,
    serviceGroupId: string,
    gradeId: string,
    kidIds: string[],
    misterIds: string[],
    active: boolean
  ) => {
    if (!selectedChurchId) return;

    const docId = classId || displayName.trim().toLowerCase().replace(/\s+/g, '_');
    const classRef = doc(db, 'churches', selectedChurchId, 'classes', docId);

    const targetClass = classes.find((c) => c.id === docId);
    const existingYears = targetClass?.academicYears || {};

    const payload = {
      active,
      serviceGroupId,
      academicYears: {
        ...existingYears,
        [academicYearId]: {
          displayName,
          name: displayName,
          serviceGroupId,
          gradeId,
          KidIds: kidIds,
          kids: kidIds,
          MistersIds: misterIds,
          servants: misterIds,
        },
      },
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
      ...(!targetClass && {
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      }),
    };

    await setDoc(classRef, payload, { merge: true });
    setAddModalOpen(false);
    setEditClass(null);
  };

  const handleDeleteClass = async (classId: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm('Delete this class? This will remove its configurations.')) {
      await deleteDoc(doc(db, 'churches', selectedChurchId, 'classes', classId));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('classes')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredClasses.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Active classrooms, grade levels, student enrollments, and teacher assignments
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class</span>
          </button>
        )}
      </div>

      {/* Details List View (DataTable) with Header Filter Matrix */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5 text-start w-24">Active</th>
                <th className="px-6 py-3.5 text-start">Class Name</th>
                <th className="px-6 py-3.5 text-start">Service Group</th>
                <th className="px-6 py-3.5 text-start">Grade Level</th>
                <th className="px-6 py-3.5 text-start">Enrolled Kids</th>
                <th className="px-6 py-3.5 text-start">Servants</th>
                <th className="px-6 py-3.5 text-end w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Header Filtering Matrix */}
              <HeaderFilterMatrix
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
              />

              {filteredClasses.map((cls) => {
                const yearData = getYearData(cls);
                if (!yearData) return null;

                const groupName = serviceGroups.find((g) => g.id === yearData.serviceGroupId)?.displayName || yearData.serviceGroupId;
                const gradeName = currentChurch?.grades?.[yearData.gradeId || '']?.name || yearData.gradeId || '-';
                const kidsCount = (yearData.KidIds || yearData.kids || []).length;
                const servantsCount = (yearData.MistersIds || yearData.servants || []).length;

                return (
                  <tr
                    key={cls.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 transition"
                  >
                    {/* 1. Active */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        cls.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cls.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {cls.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* 2. DisplayName */}
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      {yearData.displayName || yearData.name || cls.id}
                    </td>

                    {/* 3. ServiceGroupId DisplayName */}
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-zinc-600 dark:text-zinc-300">
                      {groupName}
                    </td>

                    {/* 4. GradeId DisplayName */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold">
                        {gradeName}
                      </span>
                    </td>

                    {/* 5. KidIds (sum of total) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">
                        <Baby className="w-3.5 h-3.5 text-teal-600" />
                        <span>{kidsCount} Kids</span>
                      </span>
                    </td>

                    {/* 6. MistersIds (sum of total) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>{servantsCount} Servants</span>
                      </span>
                    </td>

                    {/* 7. Actions */}
                    <td className="px-6 py-4 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditClass(cls)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          title="Edit Class"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Class"
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

      {/* Class Modal (Add & Edit) */}
      {(addModalOpen || editClass) && (
        <ClassFormModal
          existingClass={editClass}
          academicYears={academicYears}
          serviceGroups={serviceGroups}
          currentChurch={currentChurch}
          allMisters={allMisters}
          allKids={allKids}
          initialYearId={selectedAcademicYearId || academicYears[0]?.id || ''}
          initialGroupId={selectedServiceGroupId || serviceGroups[0]?.id || ''}
          onClose={() => {
            setAddModalOpen(false);
            setEditClass(null);
          }}
          onSave={handleSaveClass}
        />
      )}
    </div>
  );
};

// Modal for Adding or Editing a Class with dynamic grade selection and chips for servants and kids
interface ClassFormModalProps {
  existingClass: ClassDoc | null;
  academicYears: Array<{ id: string; displayName: string }>;
  serviceGroups: Array<{ id: string; displayName: string }>;
  currentChurch: Church | null;
  allMisters: Mister[];
  allKids: Kid[];
  initialYearId: string;
  initialGroupId: string;
  onClose: () => void;
  onSave: (
    classId: string | null,
    academicYearId: string,
    displayName: string,
    serviceGroupId: string,
    gradeId: string,
    kidIds: string[],
    misterIds: string[],
    active: boolean
  ) => void;
}

const ClassFormModal: React.FC<ClassFormModalProps> = ({
  existingClass,
  academicYears,
  serviceGroups,
  currentChurch,
  allMisters,
  allKids,
  initialYearId,
  initialGroupId,
  onClose,
  onSave,
}) => {
  const existingYearData = existingClass ? (existingClass.academicYears[initialYearId] || Object.values(existingClass.academicYears)[0]) : null;

  const [active, setActive] = useState(existingClass ? existingClass.active !== false : true);
  const [selectedYearId, setSelectedYearId] = useState(initialYearId);
  const [displayName, setDisplayName] = useState(existingYearData?.displayName || existingYearData?.name || '');
  const [selectedGroupId, setSelectedGroupId] = useState(existingYearData?.serviceGroupId || initialGroupId);
  const [selectedGradeId, setSelectedGradeId] = useState(existingYearData?.gradeId || '');

  // Misters & Kids chips state
  const [selectedMisterIds, setSelectedMisterIds] = useState<string[]>(
    existingYearData?.MistersIds || existingYearData?.servants || []
  );
  const [selectedKidIds, setSelectedKidIds] = useState<string[]>(
    existingYearData?.KidIds || existingYearData?.kids || []
  );

  // Popups for selecting misters and kids
  const [misterPickerOpen, setMisterPickerOpen] = useState(false);
  const [kidPickerOpen, setKidPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Dynamically filter grades based on the selected serviceGroupId from currentChurch.grades!
  const availableGrades = Object.entries(currentChurch?.grades || {})
    .filter(([_, item]) => item.serviceGroupId === selectedGroupId)
    .map(([intKey, item]) => ({ id: intKey, displayName: `${item.name} (#${intKey})` }));

  // Auto-set gradeId if not valid for selected group
  useEffect(() => {
    if (availableGrades.length > 0 && !availableGrades.some((g) => g.id === selectedGradeId)) {
      setSelectedGradeId(availableGrades[0].id);
    }
  }, [selectedGroupId, availableGrades]);

  const handleToggleMister = (email: string) => {
    const key = email.toLowerCase();
    if (selectedMisterIds.includes(key)) {
      setSelectedMisterIds(selectedMisterIds.filter((e) => e !== key));
    } else {
      setSelectedMisterIds([...selectedMisterIds, key]);
    }
  };

  const handleToggleKid = (kidId: string) => {
    if (selectedKidIds.includes(kidId)) {
      setSelectedKidIds(selectedKidIds.filter((k) => k !== kidId));
    } else {
      setSelectedKidIds([...selectedKidIds, kidId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      alert('Class name is mandatory.');
      return;
    }
    if (!selectedGroupId) {
      alert('Service group selection is mandatory.');
      return;
    }

    onSave(
      existingClass ? existingClass.id : null,
      selectedYearId,
      displayName,
      selectedGroupId,
      selectedGradeId,
      selectedKidIds,
      selectedMisterIds,
      active
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {existingClass ? 'Edit Class' : 'Add New Class'}
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Active Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Active Status *</label>
              <select
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Academic Year *</label>
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Class Display Name */}
          <div>
            <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Class Display Name *</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Grade 4 St. George"
              required
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
            />
          </div>

          {/* Service Group & Dynamically Bound Grade Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Service Group *</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                {serviceGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Grade Level * (Dynamic)
              </label>
              <select
                value={selectedGradeId}
                onChange={(e) => setSelectedGradeId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              >
                {availableGrades.length === 0 && (
                  <option value="" disabled>No grades linked to group</option>
                )}
                {availableGrades.map((gr) => (
                  <option key={gr.id} value={gr.id}>
                    {gr.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Misters Chips Section */}
          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Class Servants ({selectedMisterIds.length})</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPickerSearch('');
                  setMisterPickerOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Servant</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/60 max-h-32 overflow-y-auto">
              {selectedMisterIds.length === 0 && (
                <span className="text-zinc-400 text-xs my-auto">No servants added yet</span>
              )}
              {selectedMisterIds.map((email) => {
                const m = allMisters.find((mis) => mis.email.toLowerCase() === email.toLowerCase());
                const name = m?.displayName || email;
                return (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 text-xs font-semibold"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleMister(email)}
                      className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Kids Chips Section */}
          <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <Baby className="w-4 h-4 text-teal-600" />
                <span>Enrolled Kids ({selectedKidIds.length})</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPickerSearch('');
                  setKidPickerOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Kid</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-800/60 max-h-36 overflow-y-auto">
              {selectedKidIds.length === 0 && (
                <span className="text-zinc-400 text-xs my-auto">No kids added yet</span>
              )}
              {selectedKidIds.map((kId) => {
                const k = allKids.find((kid) => kid.id === kId);
                const name = k?.info?.fullName || kId;
                return (
                  <span
                    key={kId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 text-xs font-semibold"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleKid(kId)}
                      className="p-0.5 rounded-full hover:bg-teal-200 dark:hover:bg-teal-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
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
              Save Class
            </button>
          </div>
        </form>
      </div>

      {/* Mister Picker Modal (Part of selected group above) */}
      {misterPickerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Select Servants for Class
                </h4>
                <p className="text-[11px] text-zinc-400">Filtered to servants in this church</p>
              </div>
              <button onClick={() => setMisterPickerOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative my-3">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search servant name or email..."
                className="w-full text-xs ps-8 pe-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pe-1">
              {allMisters
                .filter((m) => {
                  if (!pickerSearch.trim()) return true;
                  const q = pickerSearch.toLowerCase();
                  return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
                })
                .map((mister) => {
                  const isSelected = selectedMisterIds.includes(mister.email.toLowerCase());

                  return (
                    <div
                      key={mister.id}
                      onClick={() => handleToggleMister(mister.email)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700'
                          : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{mister.displayName}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{mister.email}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setMisterPickerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
              >
                Done Selecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kid Picker Modal */}
      {kidPickerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Select Kids for Class
                </h4>
                <p className="text-[11px] text-zinc-400">Search by student name or father name</p>
              </div>
              <button onClick={() => setKidPickerOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative my-3">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search kid name or father name..."
                className="w-full text-xs ps-8 pe-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pe-1">
              {allKids
                .filter((k) => {
                  if (!pickerSearch.trim()) return true;
                  const q = pickerSearch.toLowerCase();
                  return (
                    k.info?.fullName?.toLowerCase().includes(q) ||
                    k.contacts?.fatherName?.toLowerCase().includes(q)
                  );
                })
                .map((kid) => {
                  const isSelected = selectedKidIds.includes(kid.id);

                  return (
                    <div
                      key={kid.id}
                      onClick={() => handleToggleKid(kid.id)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700'
                          : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{kid.info.fullName}</p>
                        <p className="text-[10px] text-zinc-400">
                          {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : 'Student'}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setKidPickerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition"
              >
                Done Selecting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
