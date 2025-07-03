package utils

import (
	"regexp"
	"testing"
)

// TestGenerateOTPForPhone tests OTP generation
func TestGenerateOTPForPhone(t *testing.T) {
	phones := []string{
		"+919876543210",
		"+15551234567",
		"+447700900123",
	}

	for _, phone := range phones {
		t.Run("OTP generation for "+phone, func(t *testing.T) {
			otp := GenerateOTPForPhone(phone)

			// Test OTP format (4 digits)
			if !regexp.MustCompile(`^\d{4}$`).MatchString(otp) {
				t.Errorf("Generated OTP '%s' does not match 4-digit format", otp)
			}

			// Test OTP length
			if len(otp) != 4 {
				t.Errorf("Expected OTP length 4, got %d", len(otp))
			}
		})
	}
}

// TestOTPRange tests that generated OTPs are within valid range
func TestOTPRange(t *testing.T) {
	phones := []string{
		"+919876543210",
		"+15551234567",
		"+447700900123",
	}

	for _, phone := range phones {
		otp := GenerateOTPForPhone(phone)

		// Check that all characters are digits
		for _, digit := range otp {
			if digit < '0' || digit > '9' {
				t.Errorf("Invalid digit in OTP %s: %c", otp, digit)
			}
		}

		// Check it's in valid 4-digit range (0000-9999)
		if !regexp.MustCompile(`^\d{4}$`).MatchString(otp) {
			t.Errorf("OTP %s is not a valid 4-digit number", otp)
		}
	}
}
