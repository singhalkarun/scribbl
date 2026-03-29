package utils

import (
	"fmt"
	"regexp"
	"strings"

	"auth/internal/config"
)

// Phone validation
func ValidatePhoneFormat(phone string) error {
	// E.164 format validation: + followed by country code (1-3 digits) and subscriber number
	// Minimum realistic length is 8 digits total (e.g., +1234567), maximum is 15
	matched, _ := regexp.MatchString(`^\+[1-9]\d{6,14}$`, phone)
	if !matched {
		return fmt.Errorf("phone number must be in E.164 format (e.g., +919876543210)")
	}
	return nil
}

// OTP validation
func ValidateOTPFormat(otp string) error {
	pattern := fmt.Sprintf(`^\d{%d}$`, config.OTPLength)
	matched, _ := regexp.MatchString(pattern, otp)
	if !matched {
		return fmt.Errorf("OTP must be exactly %d digits", config.OTPLength)
	}
	return nil
}

// Name validation
func ValidateName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name cannot be empty")
	}

	if len(name) < config.MinNameLength {
		return fmt.Errorf("name must be at least %d character", config.MinNameLength)
	}

	if len(name) > config.MaxNameLength {
		return fmt.Errorf("name cannot be longer than %d characters", config.MaxNameLength)
	}

	return nil
}

// SanitizeName trims whitespace and collapses multiple spaces
func SanitizeName(name string) string {
	// Trim leading and trailing whitespace
	name = strings.TrimSpace(name)
	// Collapse multiple internal spaces into single spaces
	re := regexp.MustCompile(`\s+`)
	return re.ReplaceAllString(name, " ")
}
