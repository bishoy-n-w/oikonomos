import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

class DropdownItem {
  final String id;
  final String displayName;
  final dynamic data; // To hold extra data if needed (e.g., activeAcademicYearId)

  DropdownItem({required this.id, required this.displayName, this.data});
}

class GlobalFilterController extends ChangeNotifier {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Selected IDs. null means "All"
  String? _selectedChurchId;
  String? _selectedAcademicYearId;
  String? _selectedServiceGroupId;
  String? _selectedClassId;

  // Available Lists
  List<DropdownItem> _churches = [];
  List<DropdownItem> _academicYears = [];
  List<DropdownItem> _serviceGroups = [];
  List<DropdownItem> _classes = [];

  // Stream Subscriptions
  StreamSubscription? _churchesSub;
  StreamSubscription? _yearsSub;
  StreamSubscription? _groupsSub;
  StreamSubscription? _classesSub;

  // Getters
  String? get selectedChurchId => _selectedChurchId;
  String? get selectedAcademicYearId => _selectedAcademicYearId;
  String? get selectedServiceGroupId => _selectedServiceGroupId;
  String? get selectedClassId => _selectedClassId;

  List<DropdownItem> get churches => _churches;
  List<DropdownItem> get academicYears => _academicYears;
  List<DropdownItem> get serviceGroups => _serviceGroups;
  List<DropdownItem> get classes => _classes;

  // We expose a boolean to know if data is still loading
  bool _isLoading = true;
  bool get isLoading => _isLoading;

  GlobalFilterController() {
    _init();
  }

  void _init() {
    _churchesSub = _firestore
        .collection('churches')
        .where('active', isEqualTo: true)
        .snapshots()
        .listen((snapshot) {
      _churches = snapshot.docs.map((doc) {
        final data = doc.data();
        return DropdownItem(
          id: doc.id,
          displayName: data['displayName'] ?? 'Unknown Church',
          data: data['activeAcademicYearId'],
        );
      }).toList();

      if (_churches.isNotEmpty) {
        if (_selectedChurchId == null ||
            !_churches.any((c) => c.id == _selectedChurchId)) {
          // Auto-select if there's only 1, or just select the first one if multiple
          // (Since an app must have a church context)
          _setChurch(_churches.first.id);
        } else {
          // Refresh cascading streams if church changed (or just to be safe)
          _loadCascadingData();
        }
      } else {
        _selectedChurchId = null;
        _resetYears();
      }
      
      _isLoading = false;
      notifyListeners();
    });
  }

  void setChurch(String? churchId) {
    if (churchId != _selectedChurchId && churchId != null) {
      _setChurch(churchId);
      notifyListeners();
    }
  }

  void _setChurch(String churchId) {
    _selectedChurchId = churchId;
    _resetYears();
    _loadCascadingData();
  }

  void setAcademicYear(String? yearId) {
    if (yearId != _selectedAcademicYearId) {
      _selectedAcademicYearId = yearId;
      _resetGroups();
      _loadGroups();
      notifyListeners();
    }
  }

  void setServiceGroup(String? groupId) {
    if (groupId != _selectedServiceGroupId) {
      _selectedServiceGroupId = groupId;
      _resetClasses();
      _loadClasses();
      notifyListeners();
    }
  }

  void setClass(String? classId) {
    if (classId != _selectedClassId) {
      _selectedClassId = classId;
      notifyListeners();
    }
  }

  void _loadCascadingData() {
    if (_selectedChurchId == null) return;
    
    // Find active year for this church to default to
    final church = _churches.firstWhere((c) => c.id == _selectedChurchId, orElse: () => DropdownItem(id: '', displayName: ''));
    final activeYearId = church.data as String?;

    _yearsSub?.cancel();
    _yearsSub = _firestore
        .collection('churches')
        .doc(_selectedChurchId)
        .collection('academicYears')
        .snapshots()
        .listen((snapshot) {
      _academicYears = snapshot.docs.map((doc) {
        return DropdownItem(
          id: doc.id,
          displayName: doc.data()['displayName'] ?? 'Unknown Year',
        );
      }).toList();

      if (_academicYears.isNotEmpty) {
        // Try to default to the church's active year
        if (activeYearId != null && _academicYears.any((y) => y.id == activeYearId)) {
             _selectedAcademicYearId = activeYearId;
        } else if (_selectedAcademicYearId == null || !_academicYears.any((y) => y.id == _selectedAcademicYearId)) {
             _selectedAcademicYearId = _academicYears.first.id;
        }
      } else {
         _selectedAcademicYearId = null;
      }
      
      _loadGroups();
      notifyListeners();
    });
  }

  void _loadGroups() {
    if (_selectedChurchId == null) return;
    
    _groupsSub?.cancel();
    _groupsSub = _firestore
        .collection('churches')
        .doc(_selectedChurchId)
        .collection('serviceGroups')
        .snapshots()
        .listen((snapshot) {
      _serviceGroups = snapshot.docs.map((doc) {
        return DropdownItem(
          id: doc.id,
          displayName: doc.data()['displayName'] ?? 'Unknown Group',
        );
      }).toList();

      if (_serviceGroups.length == 1) {
         _selectedServiceGroupId = _serviceGroups.first.id;
      } else if (_selectedServiceGroupId != null && !_serviceGroups.any((g) => g.id == _selectedServiceGroupId)) {
         _selectedServiceGroupId = null; // Reset to "All" if previously selected group is gone
      }

      _loadClasses();
      notifyListeners();
    });
  }

  void _loadClasses() {
     if (_selectedChurchId == null || _selectedAcademicYearId == null) return;

     _classesSub?.cancel();
     // We query ALL classes for the church. Then in Dart we filter based on if they have mapping in the selected academic year, 
     // and if they match the selected service group (if any).
     _classesSub = _firestore
        .collection('churches')
        .doc(_selectedChurchId)
        .collection('classes')
        .where('active', isEqualTo: true)
        .snapshots()
        .listen((snapshot) {
            
      List<DropdownItem> filteredClasses = [];
      for(var doc in snapshot.docs) {
         final data = doc.data();
         final yearsMap = data['academicYears'] as Map<String, dynamic>? ?? {};
         
         // Only include classes that exist in this academic year
         if(yearsMap.containsKey(_selectedAcademicYearId)) {
            final yearData = yearsMap[_selectedAcademicYearId] as Map<String, dynamic>;
            final classGroupId = yearData['serviceGroupId'] as String?;
            
            // If a specific group is selected, filter out classes not in it
            if(_selectedServiceGroupId == null || _selectedServiceGroupId == classGroupId) {
               filteredClasses.add(DropdownItem(
                  id: doc.id, 
                  displayName: yearData['name'] ?? 'Unknown Class'
               ));
            }
         }
      }
      _classes = filteredClasses;

      if (_classes.length == 1) {
         _selectedClassId = _classes.first.id;
      } else if (_selectedClassId != null && !_classes.any((c) => c.id == _selectedClassId)) {
         _selectedClassId = null; 
      }
      
      notifyListeners();
    });
  }


  void _resetYears() {
    _selectedAcademicYearId = null;
    _academicYears = [];
    _yearsSub?.cancel();
    _resetGroups();
  }

  void _resetGroups() {
    _selectedServiceGroupId = null;
    _serviceGroups = [];
    _groupsSub?.cancel();
    _resetClasses();
  }

  void _resetClasses() {
    _selectedClassId = null;
    _classes = [];
    _classesSub?.cancel();
  }

  @override
  void dispose() {
    _churchesSub?.cancel();
    _yearsSub?.cancel();
    _groupsSub?.cancel();
    _classesSub?.cancel();
    super.dispose();
  }
}
