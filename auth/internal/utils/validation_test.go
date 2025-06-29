package utils

import (
	"testing"
)

// TestValidatePhoneFormat tests phone number validation
func TestValidatePhoneFormat(t *testing.T) {
	tests := []struct {
		name    string
		phone   string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid E.164 format - India",
			phone:   "+919876543210",
			wantErr: false,
		},
		{
			name:    "valid E.164 format - US",
			phone:   "+15551234567",
			wantErr: false,
		},
		{
			name:    "valid E.164 format - UK",
			phone:   "+447700900123",
			wantErr: false,
		},
		{
			name:    "missing plus sign",
			phone:   "919876543210",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "starts with zero after plus",
			phone:   "+019876543210",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "too short",
			phone:   "+123456",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "too long",
			phone:   "+1234567890123456",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "contains letters",
			phone:   "+91abc7543210",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "contains spaces",
			phone:   "+91 9876 543210",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "contains dashes",
			phone:   "+91-9876-543210",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "empty string",
			phone:   "",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
		{
			name:    "just plus sign",
			phone:   "+",
			wantErr: true,
			errMsg:  "phone number must be in E.164 format (e.g., +919876543210)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePhoneFormat(tt.phone)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidatePhoneFormat(%s) expected error, got nil", tt.phone)
				} else if tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("ValidatePhoneFormat(%s) error = %v, want error containing %v", tt.phone, err, tt.errMsg)
				}
			} else {
				if err != nil {
					t.Errorf("ValidatePhoneFormat(%s) unexpected error = %v", tt.phone, err)
				}
			}
		})
	}
}

// TestValidateOTPFormat tests OTP validation
func TestValidateOTPFormat(t *testing.T) {
	tests := []struct {
		name    string
		otp     string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid 4-digit OTP",
			otp:     "1234",
			wantErr: false,
		},
		{
			name:    "valid 4-digit OTP with zeros",
			otp:     "0000",
			wantErr: false,
		},
		{
			name:    "valid 4-digit OTP starting with zero",
			otp:     "0123",
			wantErr: false,
		},
		{
			name:    "3-digit OTP",
			otp:     "123",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
		{
			name:    "5-digit OTP",
			otp:     "12345",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
		{
			name:    "6-digit OTP (legacy)",
			otp:     "123456",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
		{
			name:    "OTP with letters",
			otp:     "12a4",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
		{
			name:    "OTP with special characters",
			otp:     "12#4",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
		{
			name:    "empty OTP",
			otp:     "",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
		{
			name:    "OTP with spaces",
			otp:     "12 4",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
		{
			name:    "OTP with newline",
			otp:     "123\n",
			wantErr: true,
			errMsg:  "OTP must be exactly 4 digits",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateOTPFormat(tt.otp)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateOTPFormat(%s) expected error, got nil", tt.otp)
				} else if tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("ValidateOTPFormat(%s) error = %v, want error containing %v", tt.otp, err, tt.errMsg)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateOTPFormat(%s) unexpected error = %v", tt.otp, err)
				}
			}
		})
	}
}

// TestValidateName tests name validation
func TestValidateName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid name",
			input:   "John Doe",
			wantErr: false,
		},
		{
			name:    "single character name",
			input:   "A",
			wantErr: false,
		},
		{
			name:    "name with spaces",
			input:   "  John Doe  ",
			wantErr: false, // Should be trimmed
		},
		{
			name:    "maximum length name",
			input:   string(make([]byte, 100)), // 100 characters
			wantErr: false,
		},
		{
			name:    "empty name",
			input:   "",
			wantErr: true,
			errMsg:  "name cannot be empty",
		},
		{
			name:    "only spaces",
			input:   "   ",
			wantErr: true,
			errMsg:  "name cannot be empty",
		},
		{
			name:    "name too long",
			input:   string(make([]byte, 101)), // 101 characters
			wantErr: true,
			errMsg:  "name cannot be longer than 100 characters",
		},
		{
			name:    "name with special characters",
			input:   "John-Doe Jr.",
			wantErr: false,
		},
		{
			name:    "name with numbers",
			input:   "John2",
			wantErr: false,
		},
		{
			name:    "unicode name",
			input:   "राज",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Fill the byte slices with 'A' for length tests
			if len(tt.input) > 50 {
				for i := range []byte(tt.input) {
					[]byte(tt.input)[i] = 'A'
				}
			}

			err := ValidateName(tt.input)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateName(%s) expected error, got nil", tt.input)
				} else if tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("ValidateName(%s) error = %v, want error containing %v", tt.input, err, tt.errMsg)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateName(%s) unexpected error = %v", tt.input, err)
				}
			}
		})
	}
}

// TestSanitizeName tests name sanitization
func TestSanitizeName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "already clean name",
			input:    "John Doe",
			expected: "John Doe",
		},
		{
			name:     "name with leading spaces",
			input:    "  John Doe",
			expected: "John Doe",
		},
		{
			name:     "name with trailing spaces",
			input:    "John Doe  ",
			expected: "John Doe",
		},
		{
			name:     "name with both leading and trailing spaces",
			input:    "  John Doe  ",
			expected: "John Doe",
		},
		{
			name:     "name with tabs",
			input:    "\tJohn Doe\t",
			expected: "John Doe",
		},
		{
			name:     "name with newlines",
			input:    "\nJohn Doe\n",
			expected: "John Doe",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "only whitespace",
			input:    "   \t\n  ",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeName(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
