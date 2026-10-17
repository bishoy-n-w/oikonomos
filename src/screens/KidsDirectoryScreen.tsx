import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useFilter } from '../context/FilterContext';
import type { Kid } from '../types';
import { GoogleContactsSyncModal } from '../components/kids/GoogleContactsSyncModal';
import { 
  Plus, 
  Search, 
  Phone, 
  MessageSquare, 
  BookUser, 
  Trash2, 
  Edit3, 
  Download, 
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const KidsDirectoryScreen: React.FC = () => {
  const { userRole } = useAuth();
  const { translate } = useApp();
  const { selectedChurchId, selectedAcademicYearId, selectedClassId, churches, classes, academicYears } = useFilter();

  const [kids, setKids] = useState<Kid[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeKid, setActiveKid] = useState<Kid | null>(null);

  // Collapsible Table Sections state (Desktop)
  const [showAddress, setShowAddress] = useState(false);
  const [showContacts, setShowContacts] = useState(true);
  const [showNotes, setShowNotes] = useState(false);

  const isAdmin = userRole === 'Admin' || userRole === 'owner';

  // Listen to Kids collection
  useEffect(() => {
    if (!selectedChurchId) return;

    const kidsRef = collection(db, 'churches', selectedChurchId, 'kids');
    const unsubscribe = onSnapshot(kidsRef, (snapshot) => {
      const items: Kid[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          active: data.active !== false,
          info: data.info || { fullName: 'Unknown', gender: 'male' },
          address: data.address,
          contacts: data.contacts,
          notes: data.notes,
          academicYearId: data.academicYearId,
          serviceGroupId: data.serviceGroupId,
          classId: data.classId,
        };
      });
      setKids(items);
    });

    return () => unsubscribe();
  }, [selectedChurchId]);

  // Filtered kids based on active status, cascading filter, and search
  const filteredKids = kids.filter((kid) => {
    if (!kid.active) return false;
    if (selectedClassId && kid.classId && kid.classId !== selectedClassId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = kid.info.fullName?.toLowerCase().includes(q);
      const matchFather = kid.contacts?.fatherName?.toLowerCase().includes(q);
      const matchPhone = kid.contacts?.fatherMob?.includes(q) || kid.contacts?.motherMob?.includes(q) || kid.contacts?.kidMob?.includes(q);
      return matchName || matchFather || matchPhone;
    }
    return true;
  });

  const activeChurchName = churches.find((c) => c.id === selectedChurchId)?.displayName || 'Church';
  const activeClassName = classes.find((c) => c.id === selectedClassId)?.displayName || 'All Classes';
  const activeYearName = academicYears.find((y) => y.id === selectedAcademicYearId)?.displayName || 'Term';

  const handleSaveKid = async (kidData: Partial<Kid>) => {
    if (!selectedChurchId) return;
    const docId = activeKid ? activeKid.id : (kidData.info?.fullName || `kid_${Date.now()}`);
    const kidRef = doc(db, 'churches', selectedChurchId, 'kids', docId);

    const payload = {
      ...kidData,
      active: true,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(kidRef, payload, { merge: true });
    setEditModalOpen(false);
    setActiveKid(null);
  };

  const handleDeleteKid = async (kidId: string, name: string) => {
    if (!selectedChurchId) return;
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      const kidRef = doc(db, 'churches', selectedChurchId, 'kids', kidId);
      await deleteDoc(kidRef);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredKids.map((k) => ({
      'Full Name': k.info.fullName,
      'Gender': k.info.gender,
      'Date of Birth': k.info.dob || '',
      'School': k.info.school || '',
      'Father Name': k.contacts?.fatherName || '',
      'Father Mobile': k.contacts?.fatherMob || '',
      'Father Job': k.contacts?.fatherProfession || '',
      'Mother Name': k.contacts?.motherName || '',
      'Mother Mobile': k.contacts?.motherMob || '',
      'Kid Mobile': k.contacts?.kidMob || '',
      'Region / Address': k.address?.region || '',
      'Notes': k.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kids Roster');
    XLSX.writeFile(workbook, `Oikonomos_Kids_${activeClassName}.xlsx`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>{translate('kids')}</span>
            <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              {filteredKids.length}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {activeChurchName} • {activeClassName}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sync to Google Contacts (The Star Feature!) */}
          <button
            onClick={() => setSyncModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition shadow-md shadow-teal-600/20 cursor-pointer"
          >
            <BookUser className="w-4 h-4" />
            <span>{translate('sync_contacts')}</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition"
          >
            <Download className="w-4 h-4" />
            <span>{translate('export_excel')}</span>
          </button>

          {/* Add Kid */}
          {isAdmin && (
            <button
              onClick={() => {
                setActiveKid(null);
                setEditModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{translate('add')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`${translate('search')} ${translate('kids')}...`}
          className="w-full text-sm ps-10 pe-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
        />
      </div>

      {/* 1. MOBILE ADAPTIVE CARD VIEW (< md) */}
      <div className="md:hidden space-y-3">
        {filteredKids.map((kid) => {
          const fatherPhone = kid.contacts?.fatherMob;
          const motherPhone = kid.contacts?.motherMob;
          const kidPhone = kid.contacts?.kidMob;
          const primaryPhone = fatherPhone || motherPhone || kidPhone;

          return (
            <div
              key={kid.id}
              className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 transition hover:shadow-md"
            >
              {/* Header: Avatar, Name & Edit */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shadow-xs ${
                    kid.info.gender === 'female' 
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' 
                      : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'
                  }`}>
                    {kid.info.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
                      {kid.info.fullName}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {kid.contacts?.fatherName ? `Father: ${kid.contacts.fatherName}` : (kid.address?.region || 'Sunday School')}
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveKid(kid);
                      setEditModalOpen(true);
                    }}
                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Touch Quick Action Buttons (Call / WhatsApp) */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                {/* Call Father */}
                {fatherPhone ? (
                  <a
                    href={`tel:${fatherPhone}`}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 transition active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{translate('call_father')}</span>
                  </a>
                ) : (
                  <div className="py-2 px-2.5 rounded-xl text-xs text-center text-zinc-300 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-800/30">
                    No Father #
                  </div>
                )}

                {/* Call Mother */}
                {motherPhone ? (
                  <a
                    href={`tel:${motherPhone}`}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 transition active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{translate('call_mother')}</span>
                  </a>
                ) : (
                  <div className="py-2 px-2.5 rounded-xl text-xs text-center text-zinc-300 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-800/30">
                    No Mother #
                  </div>
                )}

                {/* WhatsApp */}
                {primaryPhone ? (
                  <a
                    href={`https://wa.me/${primaryPhone.replace(/\+/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 transition active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{translate('whatsapp')}</span>
                  </a>
                ) : (
                  <div className="py-2 px-2.5 rounded-xl text-xs text-center text-zinc-300 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-800/30">
                    No WhatsApp
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. DESKTOP HIGH-DENSITY DATA TABLE (>= md) */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {/* Collapsible Column Toggles Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-xs text-zinc-500">
          <span>Columns layout:</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowContacts(!showContacts)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                showContacts ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300' : 'bg-transparent border-zinc-200 dark:border-zinc-700'
              }`}
            >
              Contacts ({showContacts ? 'Visible' : 'Hidden'})
            </button>
            <button
              onClick={() => setShowAddress(!showAddress)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                showAddress ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300' : 'bg-transparent border-zinc-200 dark:border-zinc-700'
              }`}
            >
              Address ({showAddress ? 'Visible' : 'Hidden'})
            </button>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                showNotes ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300' : 'bg-transparent border-zinc-200 dark:border-zinc-700'
              }`}
            >
              Notes ({showNotes ? 'Visible' : 'Hidden'})
            </button>
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3.5 text-start">Student Name</th>
                <th className="px-4 py-3.5 text-start">Gender</th>
                <th className="px-4 py-3.5 text-start">Date of Birth</th>
                {showContacts && (
                  <>
                    <th className="px-4 py-3.5 text-start">Father</th>
                    <th className="px-4 py-3.5 text-start">Father Phone</th>
                    <th className="px-4 py-3.5 text-start">Mother</th>
                    <th className="px-4 py-3.5 text-start">Mother Phone</th>
                  </>
                )}
                {showAddress && (
                  <th className="px-4 py-3.5 text-start">Region / Address</th>
                )}
                {showNotes && (
                  <th className="px-4 py-3.5 text-start">Notes</th>
                )}
                <th className="px-6 py-3.5 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-medium">
              {filteredKids.map((kid) => (
                <tr key={kid.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition">
                  {/* Name */}
                  <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    {kid.info.fullName}
                  </td>
                  {/* Gender */}
                  <td className="px-4 py-4 whitespace-nowrap capitalize">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      kid.info.gender === 'female' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                    }`}>
                      {kid.info.gender}
                    </span>
                  </td>
                  {/* DOB */}
                  <td className="px-4 py-4 whitespace-nowrap text-zinc-500">
                    {kid.info.dob || '-'}
                  </td>
                  {/* Contacts */}
                  {showContacts && (
                    <>
                      <td className="px-4 py-4 whitespace-nowrap">{kid.contacts?.fatherName || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap font-mono">
                        {kid.contacts?.fatherMob ? (
                          <a href={`tel:${kid.contacts.fatherMob}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                            {kid.contacts.fatherMob}
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{kid.contacts?.motherName || '-'}</td>
                      <td className="px-4 py-4 whitespace-nowrap font-mono">
                        {kid.contacts?.motherMob ? (
                          <a href={`tel:${kid.contacts.motherMob}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                            {kid.contacts.motherMob}
                          </a>
                        ) : '-'}
                      </td>
                    </>
                  )}
                  {/* Address */}
                  {showAddress && (
                    <td className="px-4 py-4 whitespace-nowrap text-zinc-500">{kid.address?.region || '-'}</td>
                  )}
                  {/* Notes */}
                  {showNotes && (
                    <td className="px-4 py-4 max-w-xs truncate text-zinc-500">{kid.notes || '-'}</td>
                  )}
                  {/* Actions */}
                  <td className="px-6 py-4 text-end whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setActiveKid(kid);
                              setEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteKid(kid.id, kid.info.fullName)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Contacts Sync Modal */}
      <GoogleContactsSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        kids={filteredKids}
        churchName={activeChurchName}
        className={activeClassName}
        yearName={activeYearName}
      />

      {/* Add / Edit Kid Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {activeKid ? 'Edit Student' : 'Add New Student'}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveKid({
                  info: {
                    fullName: formData.get('fullName') as string,
                    gender: formData.get('gender') as 'male' | 'female',
                    dob: formData.get('dob') as string,
                    school: formData.get('school') as string,
                  },
                  contacts: {
                    fatherName: formData.get('fatherName') as string,
                    fatherMob: formData.get('fatherMob') as string,
                    motherName: formData.get('motherName') as string,
                    motherMob: formData.get('motherMob') as string,
                  },
                  address: {
                    region: formData.get('region') as string,
                  },
                  notes: formData.get('notes') as string,
                  classId: selectedClassId || undefined,
                  academicYearId: selectedAcademicYearId || undefined,
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Full Name *</label>
                <input
                  name="fullName"
                  defaultValue={activeKid?.info.fullName || ''}
                  required
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Gender</label>
                  <select
                    name="gender"
                    defaultValue={activeKid?.info.gender || 'male'}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    defaultValue={activeKid?.info.dob || ''}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Father Name</label>
                  <input
                    name="fatherName"
                    defaultValue={activeKid?.contacts?.fatherName || ''}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Father Mobile</label>
                  <input
                    name="fatherMob"
                    placeholder="+201..."
                    defaultValue={activeKid?.contacts?.fatherMob || ''}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Mother Name</label>
                  <input
                    name="motherName"
                    defaultValue={activeKid?.contacts?.motherName || ''}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Mother Mobile</label>
                  <input
                    name="motherMob"
                    placeholder="+201..."
                    defaultValue={activeKid?.contacts?.motherMob || ''}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Region / Address</label>
                <input
                  name="region"
                  defaultValue={activeKid?.address?.region || ''}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Pastoral Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={activeKid?.notes || ''}
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
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
