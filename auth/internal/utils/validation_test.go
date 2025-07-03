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
			name:    "missing plus sign",
			phone:   "919876543210",
			wantErr: true,
		},
		{
			name:    "too short",
			phone:   "+123456",
			wantErr: true,
		},
		{
			name:    "contains letters",
			phone:   "+91abc7543210",
			wantErr: true,
		},
		{
			name:    "empty string",
			phone:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePhoneFormat(tt.phone)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePhoneFormat(%s) error = %v, wantErr %v", tt.phone, err, tt.wantErr)
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
	}{
		{
			name:    "valid 4-digit OTP",
			otp:     "1234",
			wantErr: false,
		},
		{
			name:    "valid OTP starting with zero",
			otp:     "0123",
			wantErr: false,
		},
		{
			name:    "3-digit OTP",
			otp:     "123",
			wantErr: true,
		},
		{
			name:    "5-digit OTP",
			otp:     "12345",
			wantErr: true,
		},
		{
			name:    "OTP with letters",
			otp:     "12a4",
			wantErr: true,
		},
		{
			name:    "empty OTP",
			otp:     "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateOTPFormat(tt.otp)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateOTPFormat(%s) error = %v, wantErr %v", tt.otp, err, tt.wantErr)
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
			name:    "empty name",
			input:   "",
			wantErr: true,
		},
		{
			name:    "only spaces",
			input:   "   ",
			wantErr: true,
		},
		{
			name:    "name too long",
			input:   string(make([]byte, 101)), // 101 characters
			wantErr: true,
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
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateName(%s) error = %v, wantErr %v", tt.input, err, tt.wantErr)
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
			name:     "name with leading and trailing spaces",
			input:    "  John Doe  ",
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
