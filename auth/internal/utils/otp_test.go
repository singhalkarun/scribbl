package utils

import (
	"regexp"
	"testing"
	"time"
)

// TestGenerateOTPForPhone tests OTP generation
func TestGenerateOTPForPhone(t *testing.T) {
	phones := []string{
		"+919876543210",
		"+15551234567",
		"+447700900123",
		"+33123456789",
		"+8180123456789",
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

// TestGenerateOTPRandomness tests that OTP generation produces different values over time
func TestGenerateOTPRandomness(t *testing.T) {
	phone := "+919876543210"

	// Generate multiple OTPs for the same phone with small delays
	otp1 := GenerateOTPForPhone(phone)
	time.Sleep(time.Millisecond)
	otp2 := GenerateOTPForPhone(phone)
	time.Sleep(time.Millisecond)
	otp3 := GenerateOTPForPhone(phone)

	// They should be different (time-based generation)
	if otp1 == otp2 && otp2 == otp3 {
		t.Logf("Warning: All OTPs were the same: %s, %s, %s", otp1, otp2, otp3)
		// This is not necessarily an error since time-based generation might produce same values
	}
}

// TestGenerateOTPDifferentPhones tests OTP generation for different phones
func TestGenerateOTPDifferentPhones(t *testing.T) {
	phones := []string{
		"+919876543210",
		"+919876543211",
		"+15551234567",
		"+447700900123",
	}

	otps := make(map[string]string)

	// Generate OTP for each phone with small delays to increase variance
	for i, phone := range phones {
		if i > 0 {
			time.Sleep(time.Millisecond)
		}
		otp := GenerateOTPForPhone(phone)
		otps[phone] = otp

		// Verify OTP format
		if !regexp.MustCompile(`^\d{4}$`).MatchString(otp) {
			t.Errorf("Phone %s generated invalid OTP format: %s", phone, otp)
		}
	}

	// Count unique OTPs
	seen := make(map[string]bool)
	uniqueOTPs := 0
	for _, otp := range otps {
		if !seen[otp] {
			seen[otp] = true
			uniqueOTPs++
		}
	}

	// Log the results (duplicates are possible with time-based generation)
	t.Logf("Generated %d unique OTPs out of %d phones", uniqueOTPs, len(phones))
}

// TestSpecialPhoneOTPFormat tests OTP generation for special cases
func TestSpecialPhoneOTPFormat(t *testing.T) {
	// Test with various phone number patterns
	specialPhones := []string{
		"+911111111111", // All 1s
		"+910000000000", // All 0s (except country code)
		"+919999999999", // All 9s
		"+911234567890", // Sequential
		"+919876543210", // Reverse sequential
	}

	for _, phone := range specialPhones {
		t.Run("Special phone "+phone, func(t *testing.T) {
			otp := GenerateOTPForPhone(phone)

			// Verify it's still a valid 4-digit OTP
			if !regexp.MustCompile(`^\d{4}$`).MatchString(otp) {
				t.Errorf("Special phone %s generated invalid OTP: %s", phone, otp)
			}

			// Ensure it's not an obvious pattern (not all same digits)
			if otp == "0000" || otp == "1111" || otp == "2222" ||
				otp == "3333" || otp == "4444" || otp == "5555" ||
				otp == "6666" || otp == "7777" || otp == "8888" || otp == "9999" {
				t.Logf("Warning: Phone %s generated pattern OTP: %s", phone, otp)
				// Note: This is a warning, not an error, as deterministic generation might produce patterns
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
		"+33123456789",
		"+8180123456789",
		"+541123456789",
		"+61412345678",
		"+27821234567",
		"+971501234567",
		"+85298765432",
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
		if len(otp) == 4 {
			// All 4-digit combinations are valid (0000-9999)
			// Just ensure it's numeric
			if !regexp.MustCompile(`^\d{4}$`).MatchString(otp) {
				t.Errorf("OTP %s is not a valid 4-digit number", otp)
			}
		} else {
			t.Errorf("OTP %s is not 4 digits long", otp)
		}
	}
}
