package models

import (
	"testing"
	"time"
)

func init() {
	// Ensure we're using mock storage for tests
	ClearMockUsers()
}

// TestUserCRUDOperations tests basic user operations
func TestUserCRUDOperations(t *testing.T) {
	ClearMockUsers()

	phone := "+919876543210"

	t.Run("create user if not exists", func(t *testing.T) {
		user, err := CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user: %v", err)
		}

		if user.Phone != phone {
			t.Errorf("Expected phone %s, got %s", phone, user.Phone)
		}

		if user.ID == 0 {
			t.Error("Expected user ID to be set")
		}

		if user.Name != nil {
			t.Error("Expected new user name to be nil")
		}

		if user.CreatedAt.IsZero() {
			t.Error("Expected CreatedAt to be set")
		}

		if user.UpdatedAt.IsZero() {
			t.Error("Expected UpdatedAt to be set")
		}
	})

	t.Run("get existing user", func(t *testing.T) {
		user, err := GetUserByPhone(phone)
		if err != nil {
			t.Fatalf("Failed to get user: %v", err)
		}

		if user.Phone != phone {
			t.Errorf("Expected phone %s, got %s", phone, user.Phone)
		}
	})

	t.Run("get non-existent user", func(t *testing.T) {
		_, err := GetUserByPhone("+911234567890")
		if err == nil {
			t.Error("Expected error for non-existent user")
		}
	})

	t.Run("create existing user returns same user", func(t *testing.T) {
		user1, err := CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user first time: %v", err)
		}

		user2, err := CreateUserIfNotExists(phone)
		if err != nil {
			t.Fatalf("Failed to create user second time: %v", err)
		}

		if user1.ID != user2.ID {
			t.Errorf("Expected same user ID, got %d and %d", user1.ID, user2.ID)
		}
	})
}

// TestUserNameUpdate tests user name update functionality
func TestUserNameUpdate(t *testing.T) {
	ClearMockUsers()

	phone := "+919876543210"

	// Create user
	user, err := CreateUserIfNotExists(phone)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	t.Run("update name", func(t *testing.T) {
		newName := "John Doe"
		err := user.UpdateName(newName)
		if err != nil {
			t.Fatalf("Failed to update name: %v", err)
		}

		if user.Name == nil || *user.Name != newName {
			t.Errorf("Expected name %s, got %v", newName, user.Name)
		}

		// Verify the name is persisted
		updatedUser, err := GetUserByPhone(phone)
		if err != nil {
			t.Fatalf("Failed to get updated user: %v", err)
		}

		if updatedUser.Name == nil || *updatedUser.Name != newName {
			t.Errorf("Name not persisted. Expected %s, got %v", newName, updatedUser.Name)
		}
	})

	t.Run("update name multiple times", func(t *testing.T) {
		names := []string{"Alice", "Bob", "Charlie"}

		for _, name := range names {
			err := user.UpdateName(name)
			if err != nil {
				t.Fatalf("Failed to update name to %s: %v", name, err)
			}

			if user.Name == nil || *user.Name != name {
				t.Errorf("Expected name %s, got %v", name, user.Name)
			}
		}
	})
}

// TestOTPOperations tests OTP storage and verification
func TestOTPOperations(t *testing.T) {
	phone := "+919876543210"
	otp := "1234"

	t.Run("store and verify valid OTP", func(t *testing.T) {
		expireAt := time.Now().Add(5 * time.Minute)

		// Store OTP
		err := StoreOTP(phone, otp, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP: %v", err)
		}

		// Verify OTP
		valid := VerifyOTP(phone, otp)
		if !valid {
			t.Error("Expected OTP to be valid")
		}
	})

	t.Run("verify invalid OTP", func(t *testing.T) {
		expireAt := time.Now().Add(5 * time.Minute)

		// Store OTP
		err := StoreOTP(phone, otp, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP: %v", err)
		}

		// Try to verify wrong OTP
		valid := VerifyOTP(phone, "0000")
		if valid {
			t.Error("Expected invalid OTP to be rejected")
		}
	})

	t.Run("verify expired OTP", func(t *testing.T) {
		expiredTime := time.Now().Add(-1 * time.Minute)

		// Store expired OTP
		err := StoreOTP(phone, otp, expiredTime)
		if err != nil {
			t.Fatalf("Failed to store expired OTP: %v", err)
		}

		// Try to verify expired OTP
		valid := VerifyOTP(phone, otp)
		if valid {
			t.Error("Expected expired OTP to be rejected")
		}
	})

	t.Run("OTP is consumed after verification", func(t *testing.T) {
		phone2 := "+911234567890"
		expireAt := time.Now().Add(5 * time.Minute)

		// Store OTP
		err := StoreOTP(phone2, otp, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP: %v", err)
		}

		// First verification should succeed
		valid := VerifyOTP(phone2, otp)
		if !valid {
			t.Error("Expected first OTP verification to succeed")
		}

		// Second verification should fail (OTP consumed)
		valid = VerifyOTP(phone2, otp)
		if valid {
			t.Error("Expected second OTP verification to fail (OTP should be consumed)")
		}
	})

	t.Run("different phones have isolated OTPs", func(t *testing.T) {
		phone1 := "+919876543210"
		phone2 := "+911234567890"
		otp1 := "1111"
		otp2 := "2222"
		expireAt := time.Now().Add(5 * time.Minute)

		// Store OTP for phone1
		err := StoreOTP(phone1, otp1, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP for phone1: %v", err)
		}

		// Store OTP for phone2
		err = StoreOTP(phone2, otp2, expireAt)
		if err != nil {
			t.Fatalf("Failed to store OTP for phone2: %v", err)
		}

		// Verify phone1 OTP with phone1
		if !VerifyOTP(phone1, otp1) {
			t.Error("Expected phone1 OTP to be valid for phone1")
		}

		// Verify phone2 OTP with phone2
		if !VerifyOTP(phone2, otp2) {
			t.Error("Expected phone2 OTP to be valid for phone2")
		}

		// Cross-verify should fail
		phone3 := "+447700900123"
		phone4 := "+15551234567"
		StoreOTP(phone3, "3333", expireAt)
		StoreOTP(phone4, "4444", expireAt)

		if VerifyOTP(phone3, "4444") {
			t.Error("Expected cross-verification to fail")
		}

		if VerifyOTP(phone4, "3333") {
			t.Error("Expected cross-verification to fail")
		}
	})
}

// TestMockStorageIsolation tests that mock storage is properly isolated
func TestMockStorageIsolation(t *testing.T) {
	// Ensure clean state
	ClearMockUsers()

	phone1 := "+919876543210"
	phone2 := "+911234567890"

	// Create users
	user1, err := CreateUserIfNotExists(phone1)
	if err != nil {
		t.Fatalf("Failed to create user1: %v", err)
	}

	user2, err := CreateUserIfNotExists(phone2)
	if err != nil {
		t.Fatalf("Failed to create user2: %v", err)
	}

	// Users should have different IDs
	if user1.ID == user2.ID {
		t.Error("Expected users to have different IDs")
	}

	// Clear and verify isolation
	ClearMockUsers()

	// Users should no longer exist
	_, err = GetUserByPhone(phone1)
	if err == nil {
		t.Error("Expected user1 to not exist after clear")
	}

	_, err = GetUserByPhone(phone2)
	if err == nil {
		t.Error("Expected user2 to not exist after clear")
	}

	// Create new user with same phone should get ID 1 again
	newUser, err := CreateUserIfNotExists(phone1)
	if err != nil {
		t.Fatalf("Failed to create new user: %v", err)
	}

	if newUser.ID != 1 {
		t.Errorf("Expected new user to have ID 1, got %d", newUser.ID)
	}
}
