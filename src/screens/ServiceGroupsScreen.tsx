import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import { HeaderFilterMatrix, type ColumnFilterConfig } from '../components/common/HeaderFilterMatrix';
import { useModalEscape } from '../utils/useModalEscape';
import { DEFAULT_EVENT_TYPES, type ServiceGroup, type Mister, type Church, type GroupEventType } from '../types';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Search, 
  Check, 
  ShieldCheck, 
  Users,
  RefreshCw,
  Calendar
} from 'lucide-react';

export const ServiceGroupsScreen: React.FC = () => {
  const { user, userRole } = useAuth();
  const { translate } = useApp();
  const { selectedChurchId } = useFilter();

  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [allMisters, setAllMisters] = useState<Mister[]>([]);
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null);

  // Header Filtering Matrix state
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ServiceGroup | null>(null);
  const [eventTypesModalGroup, setEventTypesModalGroup] = useState<ServiceGroup | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  useModalEscape(() => setEditGroup(null), !!editGroup && !eventTypesModalGroup);
  useModalEscape(() => setAddModalOpen(false), addModalOpen && !eventTypesModalGroup);
  useModalEscape(() => setEventTypesModalGroup(null), !!eventTypesModalGroup);

  // 1. Listen to current church doc (for grade assignments)
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(doc(db, 'churches', selectedChurchId), (snap) => {
      if (snap.exists()) {
        setCurrentChurch({ id: snap.id, ...snap.data() } as Church);
      }
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 2. Listen to misters in church
  useEffect(() => {
    if (!selectedChurchId) return;
    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'misters'), (snap) => {
      const items: Mister[] = snap.docs.map((d) => ({
        id: d.id,
        email: d.data().email || d.id,
        displayName: d.data().displayName || d.id,
        active: d.data().active !== false,
        churchRole: d.data().churchRole || 'viewer',
        personalInfo: d.data().personalInfo,
      }));
      setAllMisters(items);
    });
    return () => unsub();
  }, [selectedChurchId]);

  // 3. Listen to service groups in selected church
  useEffect(() => {
    if (!selectedChurchId) return;

    const unsub = onSnapshot(collection(db, 'churches', selectedChurchId, 'serviceGroups'), (snap) => {
      const items: ServiceGroup[] = snap.docs.map((d) => {
        const data = d.data();
        const mistersMap: Record<string, 'admin' | 'servant'> = data.misters || {};

        // Derive admins and servants from misters map or fallback arrays
        const admins = Object.entries(mistersMap)
          .filter(([_, role]) => role === 'admin')
          .map(([email]) => email);

        const servants = Object.entries(mistersMap)
          .filter(([_, role]) => role === 'servant')
          .map(([email]) => email);

        return {
          id: d.id,
          displayName: data.displayName || d.id,
          active: data.active !== false,
          misters: mistersMap,
          admins: admins.length > 0 ? admins : (data.admins || []),
          servants: servants.length > 0 ? servants : (data.servants || []),
          eventTypes: data.eventTypes || [],
          createdAt: data.createdAt,
          createdBy: data.createdBy,
        };
      });
      setGroups(items);
    });

    return () => unsub();
  }, [selectedChurchId]);

  // Column Filter Matrix configs
  const filterConfigs: ColumnFilterConfig[] = [
    { key: 'active', type: 'boolean' },
    { key: 'displayName', type: 'text', placeholder: `${translate('search')} ${translate('group_name')}...` },
    { key: 'admins', type: 'text', placeholder: `${translate('search')} ${translate('admins_coordinators')}...` },
    { key: 'servantsCount', type: 'number', placeholder: translate('min_servants') },
    { key: 'grades', type: 'text', placeholder: `${translate('search')} ${translate('assigned_grades')}...` },
    { key: 'eventTypes', type: 'text', placeholder: `${translate('search')} ${translate('event_types')}...` },
    { key: 'actions', type: 'text', placeholder: '' },
  ];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Helper: Get grades assigned to a group from churches.grades
  const getGradesForGroup = (groupId: string): Array<{ id: string; name: string }> => {
    if (!currentChurch?.grades) return [];
    return Object.entries(currentChurch.grades)
      .filter(([_, item]) => item.serviceGroupId === groupId)
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
      .map(([intKey, item]) => ({ id: intKey, name: item.name }));
  };

  // Filtered groups
  const filteredGroups = groups.filter((g) => {
    if (filters.active !== undefined && filters.active !== '') {
      if (String(g.active) !== filters.active) return false;
    }
    if (filters.displayName) {
      if (!g.displayName.toLowerCase().includes(filters.displayName.toLowerCase())) return false;
    }
    if (filters.admins) {
      const adminNames = (g.admins || []).map((email) => {
        const m = allMisters.find((mis) => mis.email.toLowerCase() === email.toLowerCase());
        return m ? m.displayName.toLowerCase() : email.toLowerCase();
      }).join(' ');
      if (!adminNames.includes(filters.admins.toLowerCase())) return false;
    }
    if (filters.servantsCount) {
      const count = (g.servants || []).length;
      if (count < parseInt(filters.servantsCount, 10)) return false;
    }
    if (filters.grades) {
      const groupGradesStr = getGradesForGroup(g.id)
        .map((gr) => `#${gr.id} ${gr.name}`)
        .join(' ')
        .toLowerCase();
      if (!groupGradesStr.includes(filters.grades.toLowerCase())) return false;
    }
    if (filters.eventTypes) {
      const typesStr = (g.eventTypes && g.eventTypes.length > 0 ? g.eventTypes : DEFAULT_EVENT_TYPES)
        .map((t) => (typeof t === 'string' ? t : t.name))
        .join(' ')
        .toLowerCase();
      if (!typesStr.includes(filters.eventTypes.toLowerCase())) return false;
    }
    return true;
  });

  // Create new service group (mandating active, displayName, and inheriting church event types)
  const handleCreateGroup = async (displayName: string, active: boolean) => {
    if (!selectedChurchId) return;
    setIsCreatingGroup(true);
    try {
      const docId = displayName.trim().toLowerCase().replace(/\s+/g, '_');
      const groupRef = doc(db, 'churches', selectedChurchId, 'serviceGroups', docId);

      const defaultList = (currentChurch?.defaultEventTypes && currentChurch.defaultEventTypes.length > 0)
        ? currentChurch.defaultEventTypes
        : DEFAULT_EVENT_TYPES;

      const initialEventTypes: GroupEventType[] = defaultList.map((name) => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        isCore: name.toLowerCase() !== 'trip' && name.toLowerCase() !== 'activity',
      }));

      await setDoc(groupRef, {
        displayName,
        active,
        misters: {},
        admins: [],
        servants: [],
        eventTypes: initialEventTypes,
        createdAt: new Date().toISOString(),
        createdBy: user?.email,
      });

      setAddModalOpen(false);
    } catch (err: any) {
      console.error('Create group failed:', err);
      alert(`Error creating group: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Save event types for group
  const handleSaveEventTypes = async (groupId: string, updatedTypes: GroupEventType[]) => {
    if (!selectedChurchId) return;
    const groupRef = doc(db, 'churches', selectedChurchId, 'serviceGroups', groupId);
    await setDoc(groupRef, {
      eventTypes: updatedTypes,
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
    }, { merge: true });
    setEventTypesModalGroup(null);
  };

  // Save edited group
  const handleSaveEditGroup = async (
    groupId: string,
    displayName: string,
    active: boolean,
    mistersMap: Record<string, 'admin' | 'servant'>
  ) => {
    if (!selectedChurchId) return;
    const groupRef = doc(db, 'churches', selectedChurchId, 'serviceGroups', groupId);

    const admins = Object.entries(mistersMap).filter(([_, r]) => r === 'admin').map(([e]) => e);
    const servants = Object.entries(mistersMap).filter(([_, r]) => r === 'servant').map(([e]) => e);

    await setDoc(groupRef, {
      displayName,
      active,
      misters: mistersMap,
      admins,
      servants,
      lastEditAt: new Date().toISOString(),
      lastEditBy: user?.email,
    }, { merge: true });

    setEditGroup(null);
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!selectedChurchId || !isAdmin) return;
    if (window.confirm(`Delete service group "${name}"? This action cannot be undone.`)) {
      await deleteDoc(doc(db, 'churches', selectedChurchId, 'serviceGroups', groupId));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('service_groups')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredGroups.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {translate('service_groups_subtitle')}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 w-fit cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{translate('add_service_group')}</span>
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
                <th className="px-6 py-3.5 text-start">{translate('group_name')}</th>
                <th className="px-6 py-3.5 text-start">{translate('admins_coordinators')}</th>
                <th className="px-6 py-3.5 text-start">{translate('servants_total')}</th>
                <th className="px-6 py-3.5 text-start">{translate('assigned_grades')}</th>
                <th className="px-6 py-3.5 text-start">{translate('event_types')}</th>
                <th className="px-6 py-3.5 text-end w-28">{translate('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {/* Header Filtering Matrix */}
              <HeaderFilterMatrix
                configs={filterConfigs}
                values={filters}
                onChange={handleFilterChange}
              />

              {filteredGroups.map((group) => {
                const groupGrades = getGradesForGroup(group.id);
                const adminsList = group.admins || [];
                const servantsCount = (group.servants || []).length;
                const groupEventTypesCount = (group.eventTypes && group.eventTypes.length > 0 ? group.eventTypes : DEFAULT_EVENT_TYPES).length;

                return (
                  <tr
                    key={group.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 transition"
                  >
                    {/* 1. Active */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        group.active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${group.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        {group.active ? translate('active_badge') : translate('inactive_badge')}
                      </span>
                    </td>

                    {/* 2. DisplayName */}
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      {group.displayName}
                    </td>

                    {/* 3. Admins (Stacked chips) */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {adminsList.length === 0 && <span className="text-zinc-400 text-[11px]">{translate('no_admins')}</span>}
                        {adminsList.map((adminEmail) => {
                          const m = allMisters.find((mis) => mis.email.toLowerCase() === adminEmail.toLowerCase());
                          const name = m?.displayName || adminEmail;
                          return (
                            <span
                              key={adminEmail}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-medium"
                            >
                              <ShieldCheck className="w-3 h-3 text-purple-600" />
                              <span className="truncate max-w-[120px]">{name}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* 4. Servants (Sum total) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-800 dark:text-zinc-200">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>{servantsCount} {translate('servants')}</span>
                      </span>
                    </td>

                    {/* 5. Grades (Assigned from church) */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {groupGrades.length === 0 && <span className="text-zinc-400 text-[11px]">{translate('no_grades_linked')}</span>}
                        {groupGrades.map((gr) => (
                          <span
                            key={gr.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold"
                          >
                            <span
                              className="font-mono text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-900/60 text-[10px]"
                              dir="ltr"
                            >
                              #{gr.id}
                            </span>
                            <bdi>{gr.name}</bdi>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 6. Event Types shortcut chip */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEventTypesModalGroup(group)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-600 transition cursor-pointer"
                        title="Configure event types for this group"
                      >
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        <span>{groupEventTypesCount} {translate('event_types')}</span>
                      </button>
                    </td>

                    {/* 6. Actions */}
                    <td className="px-6 py-4 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditGroup(group)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          title="Edit Group & Servants"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteGroup(group.id, group.displayName)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Group"
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

      {/* Edit Group Modal (Admins and Servants chips editor with '+' picker) */}
      {editGroup && (
        <EditServiceGroupModal
          group={editGroup}
          allMisters={allMisters}
          groups={groups}
          onClose={() => setEditGroup(null)}
          onSave={(name, active, mistersMap) => handleSaveEditGroup(editGroup.id, name, active, mistersMap)}
        />
      )}

      {/* Add Group Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Add New Service Group
              </h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateGroup(
                  formData.get('displayName') as string,
                  formData.get('active') === 'true'
                );
              }}
              className="space-y-4 text-xs"
            >
              <fieldset disabled={isCreatingGroup} className="space-y-4">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('group_name')} *</label>
                  <input
                    name="displayName"
                    required
                    placeholder="e.g. High School Service Group"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('active_badge')}</label>
                  <select
                    name="active"
                    defaultValue="true"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  >
                    <option value="true">{translate('active_badge')}</option>
                    <option value="false">{translate('inactive_badge')}</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={isCreatingGroup}
                    onClick={() => setAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
                  >
                    {translate('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingGroup}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingGroup && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>{isCreatingGroup ? translate('saving') : translate('add_service_group')}</span>
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Manage Group Event Types Modal */}
      {eventTypesModalGroup && (
        <ManageGroupEventTypesModal
          group={eventTypesModalGroup}
          churchDefaultTypes={currentChurch?.defaultEventTypes}
          canEdit={isAdmin || (!!user?.email && (eventTypesModalGroup.admins || []).map((e) => e.toLowerCase()).includes(user.email.toLowerCase()))}
          onClose={() => setEventTypesModalGroup(null)}
          onSave={(updatedTypes) => handleSaveEventTypes(eventTypesModalGroup.id, updatedTypes)}
        />
      )}
    </div>
  );
};

// Sub-component: Edit Service Group Modal with chip editor and '+' servant picker
interface EditServiceGroupModalProps {
  group: ServiceGroup;
  allMisters: Mister[];
  groups: ServiceGroup[];
  onClose: () => void;
  onSave: (displayName: string, active: boolean, mistersMap: Record<string, 'admin' | 'servant'>) => void;
}

const EditServiceGroupModal: React.FC<EditServiceGroupModalProps> = ({
  group,
  allMisters,
  groups,
  onClose,
  onSave,
}) => {
  const { translate } = useApp();
  const [displayName, setDisplayName] = useState(group.displayName);
  const [active, setActive] = useState(group.active !== false);
  const [mistersMap, setMistersMap] = useState<Record<string, 'admin' | 'servant'>>({
    ...(group.misters || {}),
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(displayName, active, mistersMap);
    } catch (err: any) {
      console.error('Save group failed:', err);
      alert(`Error saving group: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Servant picker popup state
  const [pickerRole, setPickerRole] = useState<'admin' | 'servant' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Remove a servant from the group
  const handleRemove = (email: string) => {
    const updated = { ...mistersMap };
    delete updated[email.toLowerCase()];
    setMistersMap(updated);
  };

  // Toggle servant in picker
  const handleTogglePickerMister = (email: string) => {
    if (!pickerRole) return;
    const key = email.toLowerCase();
    const updated = { ...mistersMap };
    if (updated[key] === pickerRole) {
      delete updated[key];
    } else {
      updated[key] = pickerRole;
    }
    setMistersMap(updated);
  };

  const admins = Object.entries(mistersMap).filter(([_, r]) => r === 'admin').map(([e]) => e);
  const servants = Object.entries(mistersMap).filter(([_, r]) => r === 'servant').map(([e]) => e);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
            {translate('edit')} {translate('service_group')}: {group.displayName}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <fieldset disabled={isSaving} className="space-y-4 text-xs">
          {/* Name & Active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('group_name')} *</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">{translate('active_badge')}</label>
              <select
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
              >
                <option value="true">{translate('active_badge')}</option>
                <option value="false">{translate('inactive_badge')}</option>
              </select>
            </div>
          </div>

          {/* 1. Admins Chips Section */}
          <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>{translate('admins_coordinators')} ({admins.length})</span>
              </label>
              <button
                type="button"
                onClick={() => setPickerRole('admin')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{translate('add')} {translate('role_admin')}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800/60">
              {admins.length === 0 && <span className="text-zinc-400 text-xs my-auto">{translate('no_admins')}</span>}
              {admins.map((email) => {
                const m = allMisters.find((mis) => mis.email.toLowerCase() === email.toLowerCase());
                const name = m?.displayName || email;
                return (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 text-xs font-semibold"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(email)}
                      className="p-0.5 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* 2. Servants Chips Section */}
          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{translate('servants')} ({servants.length})</span>
              </label>
              <button
                type="button"
                onClick={() => setPickerRole('servant')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{translate('add')} {translate('servant')}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/60 max-h-40 overflow-y-auto">
              {servants.length === 0 && <span className="text-zinc-400 text-xs my-auto">{translate('no_servants')}</span>}
              {servants.map((email) => {
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
                      onClick={() => handleRemove(email)}
                      className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
            >
              {translate('cancel')}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
            >
              {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{isSaving ? translate('saving') : translate('save')}</span>
            </button>
          </div>
        </fieldset>
      </div>

      {/* Multi-Select Servant Picker Popup */}
      {pickerRole && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Select {pickerRole === 'admin' ? 'Coordinators' : 'Servants'}
                </h4>
                <p className="text-[11px] text-zinc-400">Search by servant name or existing assigned group</p>
              </div>
              <button onClick={() => setPickerRole(null)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative my-3">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search servant or group..."
                className="w-full text-xs ps-8 pe-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pe-1">
              {allMisters
                .filter((m) => {
                  if (!pickerSearch.trim()) return true;
                  const q = pickerSearch.toLowerCase();
                  return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
                })
                .map((mister) => {
                  const isSelected = mistersMap[mister.email.toLowerCase()] === pickerRole;

                  // Find other groups this servant is part of
                  const memberInGroups = groups
                    .filter((g) => (g.admins || []).includes(mister.email) || (g.servants || []).includes(mister.email))
                    .map((g) => g.displayName);

                  return (
                    <div
                      key={mister.id}
                      onClick={() => handleTogglePickerMister(mister.email)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700'
                          : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{mister.displayName}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{mister.email}</p>
                        {memberInGroups.length > 0 && (
                          <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-0.5">
                            Also in: {memberInGroups.join(', ')}
                          </p>
                        )}
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
                onClick={() => setPickerRole(null)}
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

// Sub-component: Manage Group Event Types Modal
interface ManageGroupEventTypesModalProps {
  group: ServiceGroup;
  churchDefaultTypes?: string[];
  onClose: () => void;
  onSave: (types: GroupEventType[]) => Promise<void>;
  canEdit: boolean;
}

const ManageGroupEventTypesModal: React.FC<ManageGroupEventTypesModalProps> = ({
  group,
  churchDefaultTypes,
  onClose,
  onSave,
  canEdit,
}) => {
  const { translate } = useApp();
  useModalEscape(onClose, true);

  const fallbackList: GroupEventType[] = (group.eventTypes && group.eventTypes.length > 0)
    ? group.eventTypes
    : ((churchDefaultTypes && churchDefaultTypes.length > 0) ? churchDefaultTypes : DEFAULT_EVENT_TYPES).map((name) => ({
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        isCore: name.toLowerCase() !== 'trip' && name.toLowerCase() !== 'activity',
      }));

  const [types, setTypes] = useState<GroupEventType[]>(fallbackList);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeIsCore, setNewTypeIsCore] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddType = () => {
    if (!newTypeName.trim()) return;
    const name = newTypeName.trim();
    if (types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      alert('Event type already exists');
      return;
    }
    const newType: GroupEventType = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      isCore: newTypeIsCore,
    };
    setTypes([...types, newType]);
    setNewTypeName('');
    setNewTypeIsCore(true);
  };

  const handleRemoveType = (id: string) => {
    setTypes(types.filter((t) => t.id !== id));
  };

  const handleToggleCore = (id: string) => {
    setTypes(types.map((t) => (t.id === id ? { ...t, isCore: !t.isCore } : t)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(types);
    } catch (err: any) {
      console.error('Save event types failed:', err);
      alert(`Error saving event types: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              {translate('event_types')}: {group.displayName}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {translate('core_attendance_hint')}
            </p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-1 text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <fieldset disabled={isSaving || !canEdit} className="space-y-3">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pe-1">
            {types.map((type) => (
              <div
                key={type.id}
                className="flex items-center justify-between p-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {translate(type.name.toLowerCase().replace(/\s+/g, '_')) || type.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Is Core Toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 select-none">
                    <input
                      type="checkbox"
                      checked={type.isCore}
                      onChange={() => handleToggleCore(type.id)}
                      disabled={!canEdit}
                      className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                    />
                    <span>{translate('is_core_attendance')}</span>
                  </label>

                  {/* Remove button */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveType(type.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      title="Delete event type"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add New Event Type */}
          {canEdit && (
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-2 pt-3">
              <label className="block font-bold text-[11px] text-zinc-700 dark:text-zinc-300">
                {translate('add_event_type')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="e.g. Hymns / ألحان"
                  className="flex-1 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddType();
                    }
                  }}
                />
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={newTypeIsCore}
                    onChange={(e) => setNewTypeIsCore(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                  />
                  <span>{translate('is_core_attendance')}</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddType}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition cursor-pointer"
                >
                  + {translate('add')}
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
            >
              {translate('cancel')}
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-md shadow-teal-600/30 cursor-pointer disabled:opacity-50"
              >
                {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSaving ? translate('saving') : translate('save')}</span>
              </button>
            )}
          </div>
        </fieldset>
      </div>
    </div>
  );
};
