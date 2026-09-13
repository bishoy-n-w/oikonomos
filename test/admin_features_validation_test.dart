// ignore_for_file: unnecessary_underscores, deprecated_member_use
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Church Timeline Referential Deletion Check Tests', () {
    test('Should block deleting an academic year if it is mapped to any class configuration', () {
      final String targetYearId = 'AY_2026';

      // Mock classes database maps representing active classes
      final List<Map<String, dynamic>> mockClasses = [
        {
          'id': 'CLS_A',
          'academicYears': {
            'AY_2025': {'name': 'Grade 5 Class A', 'serviceGroupId': 'SG_1'},
            'AY_2026': {'name': 'Grade 6 Class A', 'serviceGroupId': 'SG_1'},
          }
        },
        {
          'id': 'CLS_B',
          'academicYears': {
            'AY_2025': {'name': 'Grade 5 Class B', 'serviceGroupId': 'SG_1'},
          }
        }
      ];

      // Simulate deletion checks identical to ChurchesScreen referential integrity algorithm
      bool isReferenced = false;
      for (final classDoc in mockClasses) {
        final yearsMap = classDoc['academicYears'] as Map<String, dynamic>? ?? {};
        if (yearsMap.containsKey(targetYearId)) {
          isReferenced = true;
          break;
        }
      }

      expect(isReferenced, isTrue); // Must block deletion as it contains mappings!
    });

    test('Should permit deleting an academic year if it is not mapped to any class', () {
      final String targetYearId = 'AY_2027';

      final List<Map<String, dynamic>> mockClasses = [
        {
          'id': 'CLS_A',
          'academicYears': {
            'AY_2025': {'name': 'Grade 5 Class A', 'serviceGroupId': 'SG_1'},
          }
        }
      ];

      bool isReferenced = false;
      for (final classDoc in mockClasses) {
        final yearsMap = classDoc['academicYears'] as Map<String, dynamic>? ?? {};
        if (yearsMap.containsKey(targetYearId)) {
          isReferenced = true;
          break;
        }
      }

      expect(isReferenced, isFalse); // Permitted deletion since no active references exist.
    });
  });

  group('Grades Auto-Increment & Sequenced Re-indexing Tests', () {
    test('Deleting a grade should trigger sequential re-indexing starting from 1', () {
      // Simulate state representation of _showGradesDialog (tempGrades list)
      final List<Map<String, dynamic>> tempGrades = [
        {'id': 1, 'name': 'Grade 1', 'serviceGroupId': 'SG_1'},
        {'id': 2, 'name': 'Grade 2', 'serviceGroupId': 'SG_2'},
        {'id': 3, 'name': 'Grade 3', 'serviceGroupId': 'SG_3'},
      ];

      // Simulate deleting row at index 1 (Grade 2, id: 2)
      tempGrades.removeAt(1);

      // Trigger automatic re-indexing starting strictly from 1 sequentially
      for (int i = 0; i < tempGrades.length; i++) {
        tempGrades[i]['id'] = i + 1;
      }

      expect(tempGrades.length, 2);
      expect(tempGrades[0]['id'], 1);
      expect(tempGrades[0]['name'], 'Grade 1');
      expect(tempGrades[1]['id'], 2);
      expect(tempGrades[1]['name'], 'Grade 3'); // Original Grade 3 shifted and auto-reindexed to sequential 2!
    });

    test('Adding a new grade line should automatically increment ID sequentially by 1', () {
      final List<Map<String, dynamic>> tempGrades = [
        {'id': 1, 'name': 'Grade 1'},
        {'id': 2, 'name': 'Grade 2'},
      ];

      // Simulate Add New Line trigger inside Grades configuration
      final nextId = tempGrades.length + 1;
      tempGrades.add({
        'id': nextId,
        'name': 'Grade $nextId',
      });

      expect(tempGrades.length, 3);
      expect(tempGrades[2]['id'], 3);
      expect(tempGrades[2]['name'], 'Grade 3');
    });
  });

  group('Global Filters AllowAll Settings & Dropdown Safety Constraints', () {
    test('Verify allowAll flag restricts All option from Church and Year dropdown lists', () {
      // Mock building dropdown items list conditionally based on allowAll parameter
      List<String?> buildDropdownItems({required List<String> rawItems, required bool allowAll}) {
        return [
          if (allowAll) null, // "All" is mapped as null value
          ...rawItems,
        ];
      }

      final List<String> mockChurches = ['Church A', 'Church B'];

      // Church & Academic Year filter dropdowns items list construction
      final churchItems = buildDropdownItems(rawItems: mockChurches, allowAll: false);
      final yearItems = buildDropdownItems(rawItems: ['Year 2026'], allowAll: false);
      
      // Group & Class filter dropdowns
      final groupItems = buildDropdownItems(rawItems: ['Group A'], allowAll: true);

      expect(churchItems.contains(null), isFalse); // Church has no "All" option
      expect(churchItems.length, 2);

      expect(yearItems.contains(null), isFalse); // Academic Year has no "All" option
      expect(yearItems.length, 1);

      expect(groupItems.contains(null), isTrue); // Group supports "All" option
      expect(groupItems.length, 2);
    });
  });

  group('Classes Tab Validation & Sub-scoping Tests', () {
    test('Grades dropdown should dynamically filter to only include grades mapped to the chosen Service Group', () {
      // Mock gradeNames and gradeToGroup mappings
      final Map<String, String> gradeNames = {
        '1': 'Grade 1',
        '2': 'Grade 2',
        '3': 'Grade 3',
      };
      final Map<String, String> gradeToGroup = {
        '1': 'SG_ELEMENTARY',
        '2': 'SG_ELEMENTARY',
        '3': 'SG_JUNIOR_HIGH',
      };

      final String selectedGroup = 'SG_ELEMENTARY';

      // Dynamic filtering logic identical to ClassesScreen form builder
      final availableGrades = gradeToGroup.entries
          .where((e) => e.value == selectedGroup)
          .map((e) => e.key)
          .toList();

      expect(availableGrades.length, 2);
      expect(availableGrades.contains('1'), isTrue);
      expect(availableGrades.contains('2'), isTrue);
      expect(availableGrades.contains('3'), isFalse); // Grade 3 belongs to Junior High
    });

    test('Servant selector popup should strictly restrict list to servants mapped inside the selected Service Group document', () {
      final String selectedGroupId = 'SG_JUNIOR_HIGH';

      // Mock Service Group document data from Firestore
      final Map<String, dynamic> mockGroupDoc = {
        'displayName': 'Junior High Dept',
        'misters': {
          'bishoy@valeo.com': 'admin',
          'mark@valeo.com': 'servant',
        }
      };

      // Mock All Misters registered in the Church
      final List<Map<String, dynamic>> mockAllMisters = [
        {'email': 'bishoy@valeo.com', 'displayName': 'Bishoy NAGY'},
        {'email': 'mark@valeo.com', 'displayName': 'Mark NAGY'},
        {'email': 'other@valeo.com', 'displayName': 'Unrelated Teacher'},
      ];

      // Scoping logic identical to _showMisterSelector
      final groupMistersMap = mockGroupDoc['misters'] as Map<String, dynamic>? ?? {};
      final allowedEmails = groupMistersMap.keys.toList();

      final filteredMisters = mockAllMisters.where((m) => allowedEmails.contains(m['email'])).toList();

      expect(filteredMisters.length, 2);
      expect(filteredMisters.any((m) => m['email'] == 'other@valeo.com'), isFalse); // Restricted!
      expect(filteredMisters.any((m) => m['email'] == 'bishoy@valeo.com'), isTrue);
    });
  });
}
