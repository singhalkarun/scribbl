package services

import (
	"os"
	"testing"
	"time"

	"auth/internal/repositories"
)

func init() {
	// Set up test environment variables
	os.Setenv("SECRET_KEY_BASE", "testsecret")
	os.Setenv("TWO_FACTOR_API_KEY", "test")
	os.Setenv("OTP_TEMPLATE_NAME", "test")
}

func TestAuthService(t *testing.T) {
	t.Run("constructor", func(t *testing.T) {
		userRepo := repositories.NewMockUserRepository()
		otpRepo := repositories.NewMockOTPRepository()

		authService := NewAuthService(userRepo, otpRepo)

		if authService == nil {
			t.Error("NewAuthService should not return nil")
		}

		// Verify it's the correct type
		if _, ok := authService.(*AuthServiceImpl); !ok {
			t.Error("NewAuthService should return *AuthServiceImpl")
		}
	})
}

func TestAuthService_RequestOTP(t *testing.T) {
	userRepo := repositories.NewMockUserRepository()
	otpRepo := repositories.NewMockOTPRepository()
	authService := NewAuthService(userRepo, otpRepo)

	t.Run("valid phone number", func(t *testing.T) {
		otpRepo.Clear()
		phone := "+19999999999" // Test phone number that doesn't send real SMS

		err := authService.RequestOTP(phone)
		if err != nil {
			t.Fatalf("Failed to request OTP: %v", err)
		}

		// Verify OTP was stored
		if otpRepo.Count() != 1 {
			t.Errorf("Expected 1 OTP to be stored, got %d", otpRepo.Count())
		}

		// Verify OTP exists for the phone
		_, _, exists := otpRepo.GetOTPInfo(phone)
		if !exists {
			t.Error("Expected OTP to exist for the phone number")
		}
	})

	t.Run("invalid phone format", func(t *testing.T) {
		otpRepo.Clear()
		invalidPhone := "invalid-phone"

		err := authService.RequestOTP(invalidPhone)
		if err == nil {
			t.Error("Expected error for invalid phone format")
		}

		if otpRepo.Count() != 0 {
			t.Errorf("Expected 0 OTPs for invalid phone, got %d", otpRepo.Count())
		}
	})
}

func TestAuthService_VerifyOTP(t *testing.T) {
	userRepo := repositories.NewMockUserRepository()
	otpRepo := repositories.NewMockOTPRepository()
	authService := NewAuthService(userRepo, otpRepo)

	t.Run("valid OTP verification", func(t *testing.T) {
		userRepo.Clear()
		otpRepo.Clear()
		phone := "+19999999999" // Test phone number
		otp := "7415"           // Fixed OTP for test phone number

		// Store OTP first
		expireAt := time.Now().Add(5 * time.Minute)
		err := otpRepo.StoreOTP(phone, otp, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP: %v", err)
		}

		// Verify OTP
		user, token, err := authService.VerifyOTP(phone, otp)
		if err != nil {
			t.Fatalf("Failed to verify OTP: %v", err)
		}

		if user == nil {
			t.Error("Expected user to be returned")
		}

		if user.Phone != phone {
			t.Errorf("Expected user phone %s, got %s", phone, user.Phone)
		}

		if token == "" {
			t.Error("Expected JWT token to be returned")
		}

		// Verify user was created
		if userRepo.Count() != 1 {
			t.Errorf("Expected 1 user to be created, got %d", userRepo.Count())
		}

		// Verify OTP was consumed
		if otpRepo.Count() != 0 {
			t.Errorf("Expected 0 OTPs after verification (consumed), got %d", otpRepo.Count())
		}
	})

	t.Run("invalid OTP", func(t *testing.T) {
		userRepo.Clear()
		otpRepo.Clear()
		phone := "+919876543210"
		correctOTP := "1234"
		wrongOTP := "0000"

		// Store OTP
		expireAt := time.Now().Add(5 * time.Minute)
		err := otpRepo.StoreOTP(phone, correctOTP, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP: %v", err)
		}

		// Try to verify wrong OTP
		user, token, err := authService.VerifyOTP(phone, wrongOTP)
		if err == nil {
			t.Error("Expected error for invalid OTP")
		}

		if user != nil {
			t.Error("Expected no user for invalid OTP")
		}

		if token != "" {
			t.Error("Expected no token for invalid OTP")
		}

		// Verify OTP still exists after failed verification
		if otpRepo.Count() != 1 {
			t.Errorf("Expected 1 OTP after failed verification, got %d", otpRepo.Count())
		}
	})

	t.Run("expired OTP", func(t *testing.T) {
		userRepo.Clear()
		otpRepo.Clear()
		phone := "+919876543210"
		otp := "1234"

		// Store expired OTP
		expiredTime := time.Now().Add(-1 * time.Minute)
		err := otpRepo.StoreOTP(phone, otp, expiredTime)
		if err != nil {
			t.Fatalf("Failed to store expired OTP: %v", err)
		}

		// Try to verify expired OTP
		user, token, err := authService.VerifyOTP(phone, otp)
		if err == nil {
			t.Error("Expected error for expired OTP")
		}

		if user != nil {
			t.Error("Expected no user for expired OTP")
		}

		if token != "" {
			t.Error("Expected no token for expired OTP")
		}
	})

	t.Run("existing user verification", func(t *testing.T) {
		userRepo.Clear()
		otpRepo.Clear()
		phone := "+919876543210"
		otp := "1234"

		// Create user first
		existingUser, err := userRepo.CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create existing user: %v", err)
		}

		// Store OTP
		expireAt := time.Now().Add(5 * time.Minute)
		err = otpRepo.StoreOTP(phone, otp, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP: %v", err)
		}

		// Verify OTP
		user, token, err := authService.VerifyOTP(phone, otp)
		if err != nil {
			t.Fatalf("Failed to verify OTP: %v", err)
		}

		if user.ID != existingUser.ID {
			t.Errorf("Expected same user ID %d, got %d", existingUser.ID, user.ID)
		}

		if token == "" {
			t.Error("Expected JWT token to be returned")
		}

		// Should still be only 1 user
		if userRepo.Count() != 1 {
			t.Errorf("Expected 1 user total, got %d", userRepo.Count())
		}
	})
}
