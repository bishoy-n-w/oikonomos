import 'package:flutter/material.dart';
import 'package:intl_phone_field/intl_phone_field.dart';
import 'package:intl_phone_field/country_picker_dialog.dart';

class OikonomosPhoneField extends StatefulWidget {
  const OikonomosPhoneField({
    required this.initialValue, // Expected as full E.164 string (e.g. "+201099441171")
    required this.labelText,
    required this.onChanged,    // Passes back complete E.164 string (e.g. "+201099441171")
    this.required = false,
    super.key,
  });

  final String initialValue;
  final String labelText;
  final Function(String e164Value) onChanged;
  final bool required;

  // --- RESILIENT EXCEL/CSV IMPORT PHONE NORMALIZER ---
  // Reads spreadsheet phone cells of any format (missing code, leading zeros, dashes)
  // and normalizes them securely to E.164 format. Defaults to Egypt dial code.
  static String parseImportedPhone(String rawInput) {
    // Strip all non-digits
    var digits = rawInput.trim().replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return '';

    // Strip leading zero if present
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }

    // If it is 10 digits and starts with standard Egyptian mobile prefixes, prepend Egypt +20
    if (digits.length == 10 &&
        (digits.startsWith('10') ||
            digits.startsWith('11') ||
            digits.startsWith('12') ||
            digits.startsWith('15'))) {
      return '+20$digits';
    }

    // If it starts with '20' and has 12 digits (already prefixed with Egypt code)
    if (digits.startsWith('20') && digits.length == 12) {
      return '+$digits';
    }

    // If it is 10 digits (US number fallback), prepend +1
    if (digits.length == 10) {
      return '+1$digits';
    }

    // If it starts with '1' and is 11 digits (already prefixed with US code)
    if (digits.startsWith('1') && digits.length == 11) {
      return '+$digits';
    }

    // Default fallback: if it already starts with Egypt's '20', prepend '+'
    if (digits.startsWith('20')) {
      return '+$digits';
    }

    // All other short or unaligned numbers default to Egypt '+20'
    return '+20$digits';
  }

  @override
  State<OikonomosPhoneField> createState() => _OikonomosPhoneFieldState();
}

class _OikonomosPhoneFieldState extends State<OikonomosPhoneField> {
  late final TextEditingController _controller;
  late String _currentIso;
  late String _currentCountryPrefix;

  @override
  void initState() {
    super.initState();
    _parseInitialValue();
  }

  void _parseInitialValue() {
    final String raw = widget.initialValue.trim();
    // Remove all non-digit formatting characters
    final String digitsOnly = raw.replaceAll(RegExp(r'\D'), '');

    if (digitsOnly.isEmpty) {
      // Default to Egypt if empty!
      _currentIso = 'EG';
      _currentCountryPrefix = '20';
      _controller = TextEditingController();
      return;
    }

    // Resolve country prefix (Egypt +20, USA +1)
    if (digitsOnly.startsWith('20')) {
      _currentIso = 'EG';
      _currentCountryPrefix = '20';
      _controller = TextEditingController(text: digitsOnly.substring(2));
    } else if (digitsOnly.startsWith('1')) {
      _currentIso = 'US';
      _currentCountryPrefix = '1';
      _controller = TextEditingController(text: digitsOnly.substring(1));
    } else {
      // Default fallback to Egypt for other inputs
      _currentIso = 'EG';
      _currentCountryPrefix = '20';
      // If it has a leading zero, strip it
      final String cleanNum = digitsOnly.startsWith('0') ? digitsOnly.substring(1) : digitsOnly;
      _controller = TextEditingController(text: cleanNum);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IntlPhoneField(
      controller: _controller,
      decoration: InputDecoration(
        labelText: widget.labelText,
        border: const OutlineInputBorder(),
        counterText: '', // Keep visual design clean and flat
      ),
      pickerDialogStyle: PickerDialogStyle(
        width: 340,
      ),
      initialCountryCode: _currentIso,
      onChanged: (phone) {
        String num = phone.number;
        
        // --- GOOGLE-STYLE REAL-TIME AUTO-STRIPPER ---
        // If they typed a leading zero, strip it immediately
        if (num.startsWith('0')) {
          num = num.substring(1);
          _controller.text = num;
          _controller.selection = TextSelection.fromPosition(
            TextPosition(offset: _controller.text.length),
          );
        }

        _currentCountryPrefix = phone.countryCode.replaceAll('+', '');
        
        // Fire callback returning single combined E.164 string (e.g. "+201099441171")
        widget.onChanged('+$_currentCountryPrefix$num');
      },
      validator: (phone) {
        if (widget.required && (phone == null || phone.number.trim().isEmpty)) {
          return '${widget.labelText.replaceAll(' *', '')} is required';
        }
        return null;
      },
    );
  }
}
