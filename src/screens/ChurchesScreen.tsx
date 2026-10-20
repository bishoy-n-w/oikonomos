import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import { normalizeDateStr } from '../utils/formatters';
import { useModalEscape } from '../utils/useModalEscape';
import { DEFAULT_EVENT_TYPES, type Church, type AcademicYear, type GradeItem } from '../types';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  GraduationCap,
  RefreshCw
} from 'lucide-react';

export const ChurchesScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { churches: userChurches, setChurch } = useFilter();

  const [churchList, setChurchList] = useState<Church[]>([]);
  const [academicYearsMap, setAcademicYearsMap] = useState<Record<string, AcademicYear[]>>({});
  const [serviceGroupsMap, setServiceGroupsMap] = useState<Record<string, Array<{ id: string; displayName: string }>>>({});
  
  // Header Filter Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Modals
  const [addChurchOpen, setAddChurchOpen] = useState(false);
  const [editChurch, setEditChurch] = useState<Church | null>(null);
  const [gradesModalChurch, setGradesModalChurch] = useState<Church | null>(null);

  // In-place academic years during church edit
  const [editYears, setEditYears] = useState<AcademicYear[]>([]);
  const [editDefaultEventTypes, setEditDefaultEventTypes] = useState<string[]>([]);
  const [newDefaultEventType, setNewDefaultEventType] = useState('');
  const [classesByChurch, setClassesByChurch] = useState<any[]>([]);

  // Loading states for saving (Approach 2)
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCreatingChurch, setIsCreatingChurch] = useState(false);

  const isOwner = userRole === 'owner';

  // Dismiss modals on Escape key without saving
  useModalEscape(() => setEditChurch(null), !!editChurch && !gradesModalChurch);
  useModalEscape(() => setAddChurchOpen(false), addChurchOpen && !gradesModalChurch);

  // 1. Listen to all churches the user belongs to
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'churches'), (snapshot) => {
      const items: Church[] = snapshot.docs
        .filter((d) => userChurches.some((uc) => uc.id === d.id))
        .map((d) => ({
          id: d.id,
          displayName: d.data().displayName || d.id,
          active: d.data().active !== false,
          activeAcademicYearId: d.data().activeAcademicYearId,
          grades: d.data().grades || {},
          defaultEventTypes: d.data().defaultEventTypes,
          createdAt: d.data().createdAt,
          createdBy: d.data().createdBy,
        }));
      setChurchList(items);

      // Listen to academic years and service groups for each church
      items.forEach((c) => {
        onSnapshot(collection(db, 'churches', c.id, 'academicYears'), (ySnap) => {
          const years: AcademicYear[] = ySnap.docs.map((yd) => ({
            id: yd.id,
            displayName: yd.data().displayName || yd.id,
            active: yd.data().active !== false,
            startDate: normalizeDateStr(yd.data().startDate),
          }));
          setAcademicYearsMap((prev) => ({ ...prev, [c.id]: years }));
        });

        onSnapshot(collection(db, 'churches', c.id, 'serviceGroups'), (gSnap) => {
          const groups = gSnap.docs.map((gd) => ({
            id: gd.id,
            displayName: gd.data().displayName || gd.id,
          }));
          setServiceGroupsMap((prev) => ({ ...prev, [c.id]: groups }));
        });
      });
    });

    return () => unsub();
  }, [userChurches]);

  // When editChurch is selected, load its academic years, event types, and classes
  useEffect(() => {
    if (!editChurch) {
      setEditYears([]);
      setEditDefaultEventTypes([]);
      setNewDefaultEventType('');
      setClassesByChurch([]);
      return;
    }
    const currentYears = academicYearsMap[editChurch.id] || [];
    setEditYears([...currentYears]);
    setEditDefaultEventTypes(editChurch.defaultEventTypes || [...DEFAULT_EVENT_TYPES]);
    setNewDefaultEventType('');

    // Fetch classes to check year reference deletion guards
    getDocs(collection(db, 'churches', editChurch.id, 'classes')).then((snap) => {
      setClassesByChurch(snap.docs.map((d) => d.data()));
    });
  }, [editChurch, academicYearsMap]);

  // Column Filter Matrix configs
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    { key: 'displayName', type: 'text', placeholder: `${translate('search')} ${translate('church_name')}...` },
    { key: 'activeYear', type: 'text', placeholder: `${translate('search')} ${translate('active_academic_year')}...` },
    { key: 'gradesCount', type: 'number', placeholder: translate('min_grades') },
    { key: 'actions', type: 'text', placeholder: '' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Filter churchList by Header Filter Matrix
  const filteredChurches = churchList.filter((c) => {
    if (filters.active !== undefined && filters.active !== '') {
      if (String(c.active) !== filters.active) return false;
    }
    if (filters.displayName) {
      if (!c.displayName.toLowerCase().includes(filters.displayName.toLowerCase())) return false;
    }
    if (filters.activeYear) {
      const activeYearName = (academicYearsMap[c.id] || []).find((y) => y.id === c.activeAcademicYearId)?.displayName || '';
      if (!activeYearName.toLowerCase().includes(filters.activeYear.toLowerCase())) return false;
    }
    if (filters.gradesCount) {
      const count = Object.keys(c.grades || {}).length;
      if (count < parseInt(filters.gradesCount, 10)) return false;
    }
    return true;
  });

  // Save Grades mapping
  const handleSaveGrades = async (churchId: string, updatedGrades: Record<string, GradeItem>) => {
    const churchRef = doc(db, 'churches', churchId);
    await setDoc(churchRef, { grades: updatedGrades }, { merge: true });
    setGradesModalChurch(null);
  };

  // Save Church & Academic Years
  const handleSaveEditChurch = async (displayName: string, active: boolean, activeAcademicYearId: string) => {
    if (!editChurch) return;

    // Validate Academic Years constraints:
    // 1. At least one year exists
    if (editYears.length === 0) {
      alert('A church must have at least one Academic Year.');
      return;
    }
    // 2. At least one active year
    if (!editYears.some((y) => y.id === activeAcademicYearId || y.active)) {
      alert('At least one Academic Year must be active.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const batch = writeBatch(db);
      const churchRef = doc(db, 'churches', editChurch.id);
      batch.set(churchRef, {
        displayName,
        active,
        activeAcademicYearId,
        defaultEventTypes: editDefaultEventTypes,
        lastEditAt: new Date().toISOString(),
        lastEditBy: user?.email,
      }, { merge: true });

      // Update in-place academic years in single atomic batch
      for (const y of editYears) {
        const yearRef = doc(db, 'churches', editChurch.id, 'academicYears', y.id);
        batch.set(yearRef, {
          displayName: y.displayName,
          active: y.id === activeAcademicYearId ? true : y.active,
          startDate: y.startDate || '',
        }, { merge: true });
      }

      await batch.commit();
      setEditChurch(null);
    } catch (err: any) {
      console.error('Save church failed:', err);
      alert(`Error saving church: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete an Academic Year with constraints
  const handleDeleteYearInEdit = (yearId: string) => {
    if (!editChurch) return;

    // Constraint: At least one year must remain
    if (editYears.length <= 1) {
      alert('Cannot delete: A church must retain at least one academic year.');
      return;
    }

    // Constraint: Cannot delete active year
    if (yearId === editChurch.activeAcademicYearId) {
      alert('Cannot delete: This is the currently active Academic Year for this church.');
      return;
    }

    // Constraint: Cannot delete if referenced in any classes
    const isReferenced = classesByChurch.some((cls) => cls.academicYears && cls.academicYears[yearId]);
    if (isReferenced) {
      alert('Cannot delete: This Academic Year is referenced in one or more classes.');
      return;
    }

    setEditYears(editYears.filter((y) => y.id !== yearId));
    // Also delete from Firestore
    deleteDoc(doc(db, 'churches', editChurch.id, 'academicYears', yearId));
  };

  // Add a new Academic Year in edit
  const handleAddYearInEdit = () => {
    const nextNum = editYears.length + 1;
    const newYearId = `year_${Date.now()}`;
    const newYear: AcademicYear = {
      id: newYearId,
      displayName: `Academic Year ${nextNum}`,
      active: false,
      startDate: new Date().toISOString().substring(0, 7), // YYYY-MM
    };
    setEditYears([...editYears, newYear]);
  };

  // Add a New Church (mandating active, displayName, and 1 initial active academicYear with YYYY-MM startDate)
  const handleCreateChurch = async (displayName: string, yearName: string, startDate: string) => {
    setIsCreatingChurch(true);
    try {
      const docId = displayName.trim().toLowerCase().replace(/\s+/g, '_');
      const yearId = yearName.trim().toLowerCase().replace(/\s+/g, '_');
      const batch = writeBatch(db);

      const churchRef = doc(db, 'churches', docId);
      const yearRef = doc(db, 'churches', docId, 'academicYears', yearId);

      batch.set(churchRef, {
        displayName,
        active: true,
        activeAcademicYearId: yearId,
        grades: {},
        defaultEventTypes: [...DEFAULT_EVENT_TYPES],
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      });

      batch.set(yearRef, {
        displayName: yearName,
        active: true,
        startDate, // YYYY-MM
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      });

      await batch.commit();
      setChurch(docId);
      setAddChurchOpen(false);
    } catch (err: any) {
      console.error('Create church failed:', err);
      alert(`Error creating church: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCreatingChurch(false);
    }
  };

  const handleDeleteChurch = async (churchId: string, name: string) => {
    if (!isOwner) return;
    if (window.confirm(`Delete church "${name}"? This action is permanent and cannot be undone.`)) {
      await deleteDoc(doc(db, 'churches', churchId));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('churches_config')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredChurches.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {translate('churches_subtitle')}
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => setAddChurchOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{translate('add_church')}</span>
          </button>
        )}
      </div>

      {/* Details List View (DataTable) with Header Filter Matrix */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5 text-start w-24">{translate('active_badge')}</th>
                <th className="px-6 py-3.5 text-start">{translate('church_name')}</th>
                <th className="px-6 py-3.5 text-start">{translate('active_academic_year')}</th>
                <th className="px-6 py-3.5 text-start">{translate('grades')}</th>
                <th className="px-6 py-3.5 text-end w-32">{translate('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Header Filtering Matrix */}
              <HeaderFilterMatrix
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
              />

              {filteredChurches.map((church) => {
                const activeYearName = (academicYearsMap[church.id] || []).find(
                  (y) => y.id === church.activeAcademicYearId
                )?.displayName || church.activeAcademicYearId || '-';

                const gradesCount = Object.keys(church.grades || {}).length;

                return (
                  <tr
                    key={church.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 transition"
                  >
                    {/* 1. Active */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        church.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${church.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {church.active ? translate('active_badge') : translate('inactive_badge')}
                      </span>
                    </td>

                    {/* 2. DisplayName */}
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      {church.displayName}
                    </td>

                    {/* 3. ActiveAcademicYear DisplayName */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                        <span>⭐</span>
                        <span>{activeYearName}</span>
                      </span>
                    </td>

                    {/* 4. Grades (only sum number of grades; clicking opens popup) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setGradesModalChurch(church)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-600 transition cursor-pointer"
                        title="Click to view and configure grade-to-group mappings"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                        <span>{gradesCount} {translate('grades')}</span>
                      </button>
                    </td>

                    {/* 5. Actions */}
                    <td className="px-6 py-4 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditChurch(church)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          title="Edit Church"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteChurch(church.id, church.displayName)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Church"
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

      {/* Edit Church Modal (with in-place Academic Years management) */}
      {editChurch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {translate('edit')} {translate('churches_config')}: {editChurch.displayName}
              </h3>
              <button onClick={() => setEditChurch(null)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveEditChurch(
                  formData.get('displayName') as string,
                  formData.get('active') === 'true',
                  formData.get('activeAcademicYearId') as string
                );
              }}
              className="space-y-5 text-xs"
            >
              <fieldset disabled={isSavingEdit} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('church_name')} *</label>
                    <input
                      name="displayName"
                      defaultValue={editChurch.displayName}
                      required
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('active_badge')}</label>
                    <select
                      name="active"
                      defaultValue={editChurch.active ? 'true' : 'false'}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                    >
                      <option value="true">{translate('active_badge')}</option>
                      <option value="false">{translate('inactive_badge')}</option>
                    </select>
                  </div>
                </div>

                {/* Grades shortcut */}
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">{translate('assigned_grades')}</p>
                    <p className="text-zinc-400 text-[11px]">{Object.keys(editChurch.grades || {}).length} {translate('grades')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGradesModalChurch(editChurch)}
                    className="px-3.5 py-1.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition cursor-pointer"
                  >
                    {translate('grades')}
                  </button>
                </div>

                {/* In-Place Academic Years Manager */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {translate('academic_year')}
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Must retain at least one year; active year and referenced years cannot be deleted.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddYearInEdit}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{translate('add')} {translate('academic_year')}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {editYears.map((y, idx) => (
                      <div
                        key={y.id}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40"
                      >
                        <input
                          type="radio"
                          name="activeAcademicYearId"
                          value={y.id}
                          defaultChecked={y.id === editChurch.activeAcademicYearId}
                          className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                          title="Set as currently active academic year"
                        />
                        <input
                          type="text"
                          value={y.displayName}
                          onChange={(e) => {
                            const updated = [...editYears];
                            updated[idx].displayName = e.target.value;
                            setEditYears(updated);
                          }}
                          placeholder={translate('academic_year')}
                          className="flex-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                        />
                        <input
                          type="month"
                          value={y.startDate?.substring(0, 7) || ''}
                          onChange={(e) => {
                            const updated = [...editYears];
                            updated[idx].startDate = e.target.value;
                            setEditYears(updated);
                          }}
                          className="w-32 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                          title="Start Date (Year & Month)"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteYearInEdit(y.id)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Delete this year"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Default Event Types Template Section */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        {translate('default_event_types_template')}
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        {translate('default_event_types_desc')}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                    {editDefaultEventTypes.map((type, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-2xs"
                      >
                        <span>{translate(type.toLowerCase().replace(/\s+/g, '_')) || type}</span>
                        <button
                          type="button"
                          onClick={() => setEditDefaultEventTypes(editDefaultEventTypes.filter((_, i) => i !== idx))}
                          className="text-zinc-400 hover:text-rose-500 transition cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}

                    <div className="flex items-center gap-1 ms-auto">
                      <input
                        type="text"
                        value={newDefaultEventType}
                        onChange={(e) => setNewDefaultEventType(e.target.value)}
                        placeholder={translate('add_event_type')}
                        className="px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs w-36"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newDefaultEventType.trim() && !editDefaultEventTypes.includes(newDefaultEventType.trim())) {
                              setEditDefaultEventTypes([...editDefaultEventTypes, newDefaultEventType.trim()]);
                              setNewDefaultEventType('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newDefaultEventType.trim() && !editDefaultEventTypes.includes(newDefaultEventType.trim())) {
                            setEditDefaultEventTypes([...editDefaultEventTypes, newDefaultEventType.trim()]);
                            setNewDefaultEventType('');
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition cursor-pointer"
                      >
                        + {translate('add')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={isSavingEdit}
                    onClick={() => setEditChurch(null)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                  >
                    {translate('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>{isSavingEdit ? translate('saving') : translate('save')}</span>
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Add New Church Wizard Modal */}
      {addChurchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {translate('add_church')}
              </h3>
              <button onClick={() => setAddChurchOpen(false)} disabled={isCreatingChurch} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateChurch(
                  formData.get('displayName') as string,
                  formData.get('yearName') as string,
                  formData.get('startDate') as string
                );
              }}
              className="space-y-4 text-xs"
            >
              <fieldset disabled={isCreatingChurch} className="space-y-4">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('church_name')} *</label>
                  <input
                    name="displayName"
                    required
                    placeholder="e.g. St. Mark Church"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('active_academic_year')} *</label>
                  <input
                    name="yearName"
                    defaultValue="Academic Year 2026-2027"
                    required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('dob')} / {translate('academic_year')} *</label>
                  <input
                    type="month"
                    name="startDate"
                    defaultValue={new Date().toISOString().substring(0, 7)}
                    required
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={isCreatingChurch}
                    onClick={() => setAddChurchOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                  >
                    {translate('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingChurch}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingChurch && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>{isCreatingChurch ? translate('saving') : translate('add_church')}</span>
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Grades Management Popup Modal (z-60 to render on top of edit modal!) */}
      {gradesModalChurch && (
        <GradesMappingModal
          church={gradesModalChurch}
          serviceGroups={serviceGroupsMap[gradesModalChurch.id] || []}
          onClose={() => setGradesModalChurch(null)}
          onSave={(grades) => handleSaveGrades(gradesModalChurch.id, grades)}
        />
      )}
    </div>
  );
};

// Sub-component: Grades Mapping Popup Modal
interface GradesMappingModalProps {
  church: Church;
  serviceGroups: Array<{ id: string; displayName: string }>;
  onClose: () => void;
  onSave: (grades: Record<string, GradeItem>) => void;
}

const GradesMappingModal: React.FC<GradesMappingModalProps> = ({
  church,
  serviceGroups,
  onClose,
  onSave,
}) => {
  const { translate } = useApp();
  useModalEscape(onClose, true);

  const [gradesMap, setGradesMap] = useState<Record<string, GradeItem>>({
    ...(church.grades || {}),
  });

  // Add new grade line: integer starts at 1 and auto-increments by system
  const handleAddGrade = () => {
    const existingKeys = Object.keys(gradesMap).map((k) => parseInt(k, 10)).filter((n) => !isNaN(n));
    const nextInt = existingKeys.length > 0 ? Math.max(...existingKeys) + 1 : 1;
    const keyStr = String(nextInt);

    setGradesMap({
      ...gradesMap,
      [keyStr]: {
        name: `Grade ${nextInt}`,
        serviceGroupId: serviceGroups[0]?.id || '',
      },
    });
  };

  const handleRemoveGrade = (key: string) => {
    const copy = { ...gradesMap };
    delete copy[key];
    setGradesMap(copy);
  };

  const handleUpdateGrade = (key: string, field: 'name' | 'serviceGroupId', val: string) => {
    setGradesMap({
      ...gradesMap,
      [key]: {
        ...gradesMap[key],
        [field]: val,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {translate('assigned_grades')}: {church.displayName}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {translate('service_groups_subtitle')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pe-1">
          {Object.entries(gradesMap).length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-6">{translate('no_grades_linked')}</p>
          )}

          {Object.entries(gradesMap)
            .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
            .map(([intKey, item]) => (
              <div
                key={intKey}
                className="flex items-center gap-2 p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700"
              >
                {/* Auto-incremented Integer badge */}
                <span className="w-7 h-7 flex items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 font-bold text-xs shrink-0">
                  {intKey}
                </span>

                {/* Free text grade name */}
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleUpdateGrade(intKey, 'name', e.target.value)}
                  placeholder={translate('grade_level')}
                  className="flex-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                />

                {/* Service Group Dropdown */}
                <select
                  value={item.serviceGroupId}
                  onChange={(e) => handleUpdateGrade(intKey, 'serviceGroupId', e.target.value)}
                  className="w-36 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                >
                  <option value="" disabled>{translate('service_group')}</option>
                  {serviceGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.displayName}
                    </option>
                  ))}
                </select>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleRemoveGrade(intKey)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  title="Remove Grade"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>

        <div className="pt-3 flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 mt-4">
          <button
            type="button"
            onClick={handleAddGrade}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{translate('add')} {translate('grade_level')}</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              {translate('cancel')}
            </button>
            <button
              type="button"
              onClick={() => onSave(gradesMap)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer"
            >
              {translate('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
